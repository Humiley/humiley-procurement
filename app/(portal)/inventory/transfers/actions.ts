"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { postMovement, StockError } from "@/lib/stock/post-movement";
import { checkReorderAfterOut } from "@/lib/stock/reorder";
import { transferCreateSchema, type TransferCreatePayload } from "@/lib/schemas/transfer";
import { assertWarehouseKeeper } from "@/lib/stock/keeper";
import { guard } from "@/lib/safe-action";

const D = Prisma.Decimal;

/** §10b stock transfer: TRANSFER_OUT on dispatch (IN_TRANSIT) → TRANSFER_IN on receipt, same cost. */
async function _createTransfer(input: TransferCreatePayload) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = transferCreateSchema.parse(input);

  const trf = await db.$transaction(async (tx) => {
    const transferNumber = await nextDocNumber("TRF", tx, { prefix: "TRF" });
    return tx.stockTransfer.create({
      data: {
        transferNumber,
        fromWarehouseId: values.fromWarehouseId,
        toWarehouseId: values.toWarehouseId,
        status: "DRAFT",
        createdById: user.id,
        lines: { create: values.lines.map((l) => ({ itemId: l.itemId, qty: new D(l.qty) })) },
      },
    });
  });

  await audit({ userId: user.id, action: "TRF_CREATE", entityType: "StockTransfer", entityId: trf.id, after: { transferNumber: trf.transferNumber, lines: values.lines.length } });
  revalidatePath("/inventory/transfers");
  return { id: trf.id };
}

/** Dispatch: ISSUED signature; every line posts TRANSFER_OUT at the source's avg cost. */
async function _dispatchTransfer(params: { id: string; password: string }) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const trf = await db.stockTransfer.findUnique({
    where: { id: params.id },
    include: { lines: { include: { item: { select: { isLotTracked: true } } } } },
  });
  if (!trf) throw new Error("Transfer not found.");
  if (trf.status !== "DRAFT") throw new Error("Only a draft transfer can be dispatched.");
  await assertWarehouseKeeper(user, trf.fromWarehouseId);

  // Pre-check stock BEFORE signing (no orphan signatures); the in-tx FOR-UPDATE guard stays
  // authoritative. §21: lot-tracked items dispatch FEFO across their lots (earliest expiry
  // first, expired lots excluded) — the balances of lot-tracked stock live on lot rows, so a
  // no-lot OUT would find nothing to move.
  const today = new Date(new Date().toDateString());
  const balances = await db.stockBalance.findMany({
    where: { warehouseId: trf.fromWarehouseId, itemId: { in: trf.lines.map((l) => l.itemId) }, qtyOnHand: { gt: 0 } },
    include: { lot: { select: { id: true, expiryDate: true } } },
  });
  const plan = new Map<string, { lotId: string | null; qty: Prisma.Decimal }[]>();
  for (const l of trf.lines) {
    let need = new D(l.qty);
    if (l.item.isLotTracked) {
      const lots = balances
        .filter((b) => b.itemId === l.itemId && b.lotId && !(b.lot?.expiryDate && b.lot.expiryDate < today))
        .sort((x, y) => (x.lot?.expiryDate?.getTime() ?? Infinity) - (y.lot?.expiryDate?.getTime() ?? Infinity));
      const parts: { lotId: string | null; qty: Prisma.Decimal }[] = [];
      for (const b of lots) {
        if (need.lessThanOrEqualTo(0)) break;
        const take = D.min(need, new D(b.qtyOnHand));
        parts.push({ lotId: b.lotId, qty: take });
        need = need.minus(take);
      }
      if (need.greaterThan(0)) {
        const avail = lots.reduce((s2, b) => s2.plus(b.qtyOnHand), new D(0));
        throw new Error(`Insufficient non-expired lot stock at source: ${avail.toString()} available, ${new D(l.qty).toString()} to transfer.`);
      }
      plan.set(l.id, parts);
    } else {
      const onHand = balances
        .filter((b) => b.itemId === l.itemId && !b.lotId)
        .reduce((s2, b) => s2.plus(b.qtyOnHand), new D(0));
      if (need.greaterThan(onHand)) {
        throw new Error(`Insufficient stock at source: ${onHand.toString()} on hand, ${need.toString()} to transfer.`);
      }
      plan.set(l.id, [{ lotId: null, qty: need }]);
    }
  }

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "StockTransfer",
      entityId: trf.id,
      meaning: "ISSUED",
      record: { transferNumber: trf.transferNumber, lines: trf.lines.map((l) => ({ i: l.itemId, q: l.qty })) },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  try {
    await db.$transaction(async (tx) => {
      for (const l of trf.lines) {
        for (const part of plan.get(l.id)!) {
          await postMovement(
            {
              type: "TRANSFER_OUT",
              warehouseId: trf.fromWarehouseId,
              itemId: l.itemId,
              lotId: part.lotId,
              qty: part.qty,
              refEntityType: "StockTransfer",
              refEntityId: trf.id,
              note: trf.transferNumber,
              createdById: user.id,
            },
            tx,
          );
        }
      }
      const ok = await tx.stockTransfer.updateMany({ where: { id: trf.id, status: "DRAFT" }, data: { status: "IN_TRANSIT" } });
      if (!ok.count) throw staleError();
    });
  } catch (e) {
    if (e instanceof StockError) throw new Error(e.message);
    throw e;
  }

  await checkReorderAfterOut(trf.fromWarehouseId, trf.lines.map((l) => l.itemId));
  await audit({ userId: user.id, action: "TRF_DISPATCH", entityType: "StockTransfer", entityId: trf.id, after: { status: "IN_TRANSIT", signatureId: sig.id } });
  revalidatePath(`/inventory/transfers/${trf.id}`);
  revalidatePath("/inventory/transfers");
  revalidatePath("/inventory");
  return { id: trf.id };
}

/** Receive: RECEIVED signature; TRANSFER_IN into the destination at the dispatch cost. */
async function _receiveTransfer(params: { id: string; password: string }) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const trf = await db.stockTransfer.findUnique({ where: { id: params.id }, include: { lines: true } });
  if (!trf) throw new Error("Transfer not found.");
  if (trf.status !== "IN_TRANSIT") throw new Error("Only an in-transit transfer can be received.");
  await assertWarehouseKeeper(user, trf.toWarehouseId);

  // Mirror the dispatch EXACTLY: one TRANSFER_IN per TRANSFER_OUT movement, same lot and same
  // unit cost — lot identity and valuation survive the move (an item appearing on two lines or
  // two lots must not collapse onto one cost).
  const outs = await db.stockMovement.findMany({
    where: { refEntityType: "StockTransfer", refEntityId: trf.id, type: "TRANSFER_OUT" },
    select: { itemId: true, lotId: true, qty: true, unitCostVnd: true },
  });
  if (!outs.length) throw new Error("No dispatch movements found for this transfer.");

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "StockTransfer",
      entityId: trf.id,
      meaning: "RECEIVED",
      record: { transferNumber: trf.transferNumber, lines: trf.lines.map((l) => ({ i: l.itemId, q: l.qty })) },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  try {
    await db.$transaction(async (tx) => {
      for (const m of outs) {
        await postMovement(
          {
            type: "TRANSFER_IN",
            warehouseId: trf.toWarehouseId,
            itemId: m.itemId,
            lotId: m.lotId,
            qty: m.qty,
            unitCostVnd: m.unitCostVnd,
            refEntityType: "StockTransfer",
            refEntityId: trf.id,
            note: trf.transferNumber,
            createdById: user.id,
          },
          tx,
        );
      }
      const ok = await tx.stockTransfer.updateMany({
        where: { id: trf.id, status: "IN_TRANSIT" },
        data: { status: "RECEIVED", receivedById: user.id },
      });
      if (!ok.count) throw staleError();
    });
  } catch (e) {
    if (e instanceof StockError) throw new Error(e.message);
    throw e;
  }

  await audit({ userId: user.id, action: "TRF_RECEIVE", entityType: "StockTransfer", entityId: trf.id, after: { status: "RECEIVED", signatureId: sig.id } });
  revalidatePath(`/inventory/transfers/${trf.id}`);
  revalidatePath("/inventory/transfers");
  revalidatePath("/inventory");
  return { id: trf.id };
}

async function _cancelTransfer(id: string) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const trf = await db.stockTransfer.findUnique({ where: { id } });
  if (!trf) throw new Error("Transfer not found.");
  if (trf.status !== "DRAFT") throw new Error("Only a draft transfer can be cancelled.");
  if (!(await transition(db.stockTransfer, id, "DRAFT", "CANCELLED"))) throw staleError();
  await audit({ userId: user.id, action: "TRF_CANCEL", entityType: "StockTransfer", entityId: id, after: { status: "CANCELLED" } });
  revalidatePath("/inventory/transfers");
  return { id };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createTransfer(...a: Parameters<typeof _createTransfer>) { return guard(_createTransfer, a); }
export async function dispatchTransfer(...a: Parameters<typeof _dispatchTransfer>) { return guard(_dispatchTransfer, a); }
export async function receiveTransfer(...a: Parameters<typeof _receiveTransfer>) { return guard(_receiveTransfer, a); }
export async function cancelTransfer(...a: Parameters<typeof _cancelTransfer>) { return guard(_cancelTransfer, a); }
