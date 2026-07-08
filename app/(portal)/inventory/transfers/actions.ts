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

const D = Prisma.Decimal;

/** §10b stock transfer: TRANSFER_OUT on dispatch (IN_TRANSIT) → TRANSFER_IN on receipt, same cost. */
export async function createTransfer(input: TransferCreatePayload) {
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
export async function dispatchTransfer(params: { id: string; password: string }) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const trf = await db.stockTransfer.findUnique({ where: { id: params.id }, include: { lines: true } });
  if (!trf) throw new Error("Transfer not found.");
  if (trf.status !== "DRAFT") throw new Error("Only a draft transfer can be dispatched.");

  // pre-check stock before signing (no orphan signatures); in-tx guard stays authoritative
  const balances = await db.stockBalance.findMany({
    where: { warehouseId: trf.fromWarehouseId, itemId: { in: trf.lines.map((l) => l.itemId) } },
  });
  const onHand = new Map(balances.map((b) => [b.itemId, b.qtyOnHand]));
  for (const l of trf.lines) {
    if (new D(l.qty).greaterThan(new D(onHand.get(l.itemId) ?? 0))) {
      throw new Error(`Insufficient stock at source: ${new D(onHand.get(l.itemId) ?? 0).toString()} on hand, ${new D(l.qty).toString()} to transfer.`);
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
        await postMovement(
          {
            type: "TRANSFER_OUT",
            warehouseId: trf.fromWarehouseId,
            itemId: l.itemId,
            qty: l.qty,
            refEntityType: "StockTransfer",
            refEntityId: trf.id,
            note: trf.transferNumber,
            createdById: user.id,
          },
          tx,
        );
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
export async function receiveTransfer(params: { id: string; password: string }) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const trf = await db.stockTransfer.findUnique({ where: { id: params.id }, include: { lines: true } });
  if (!trf) throw new Error("Transfer not found.");
  if (trf.status !== "IN_TRANSIT") throw new Error("Only an in-transit transfer can be received.");

  const outs = await db.stockMovement.findMany({
    where: { refEntityType: "StockTransfer", refEntityId: trf.id, type: "TRANSFER_OUT" },
    select: { itemId: true, unitCostVnd: true },
  });
  const costByItem = new Map(outs.map((m) => [m.itemId, m.unitCostVnd]));

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
      for (const l of trf.lines) {
        await postMovement(
          {
            type: "TRANSFER_IN",
            warehouseId: trf.toWarehouseId,
            itemId: l.itemId,
            qty: l.qty,
            unitCostVnd: costByItem.get(l.itemId) ?? 0,
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

export async function cancelTransfer(id: string) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const trf = await db.stockTransfer.findUnique({ where: { id } });
  if (!trf) throw new Error("Transfer not found.");
  if (trf.status !== "DRAFT") throw new Error("Only a draft transfer can be cancelled.");
  if (!(await transition(db.stockTransfer, id, "DRAFT", "CANCELLED"))) throw staleError();
  await audit({ userId: user.id, action: "TRF_CANCEL", entityType: "StockTransfer", entityId: id, after: { status: "CANCELLED" } });
  revalidatePath("/inventory/transfers");
  return { id };
}
