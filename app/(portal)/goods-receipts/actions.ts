"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { grnCreateSchema, grnAcceptSchema, type GrnCreatePayload, type GrnAcceptPayload } from "@/lib/schemas/grn";
import { postMovement } from "@/lib/stock/post-movement";
import { nextLotNumber, ensureItemBarcode, createLotBarcode } from "@/lib/barcode";
import { assertWarehouseKeeper } from "@/lib/stock/keeper";
import { guard } from "@/lib/safe-action";

const D = Prisma.Decimal;

/** §9 GRN: WAREHOUSE receives against an open PO; over-receipt blocked (tolerance 0%). */
async function _createGrn(input: GrnCreatePayload) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = grnCreateSchema.parse(input);

  const po = await db.purchaseOrder.findUnique({ where: { id: values.poId }, include: { lines: true } });
  // §15 SoD: the PO creator cannot post the goods receipt of their own PO (ADMIN excepted).
  if (po && po.createdById === user.id && !user.roles.includes("ADMIN")) {
    throw new Error("Segregation of duties: the PO creator cannot post its goods receipt (§15).");
  }
  if (!po) throw new Error("Purchase order not found.");
  if (!["SENT", "PARTIALLY_RECEIVED"].includes(po.status)) {
    throw new Error("Goods can only be received against a SENT or partially received PO.");
  }
  const wh = await db.warehouse.findUnique({ where: { id: values.warehouseId } });
  if (!wh) throw new Error("Warehouse not found.");

  const lineById = new Map(po.lines.map((l) => [l.id, l]));
  const receiving = values.lines.filter((l) => Number(l.qtyReceived) > 0);
  for (const l of receiving) {
    const pol = lineById.get(l.poLineId);
    if (!pol) throw new Error("Line does not belong to this PO.");
    const outstanding = new D(pol.qty).minus(pol.receivedQty);
    if (new D(l.qtyReceived).greaterThan(outstanding)) {
      throw new Error(`Over-receipt blocked: "${pol.description}" has only ${outstanding.toString()} outstanding (tolerance 0%).`);
    }
  }

  const grn = await db.$transaction(async (tx) => {
    const grnNumber = await nextDocNumber("GRN", tx, { prefix: "GRN" });
    return tx.goodsReceipt.create({
      data: {
        grnNumber,
        poId: po.id,
        warehouseId: wh.id,
        receivedById: user.id,
        status: "QC_PENDING",
        notes: values.notes || null,
        lines: { create: receiving.map((l) => ({ poLineId: l.poLineId, qtyReceived: new D(l.qtyReceived) })) },
      },
    });
  });

  await audit({ userId: user.id, action: "GRN_CREATE", entityType: "GoodsReceipt", entityId: grn.id, after: { grnNumber: grn.grnNumber, po: po.poNumber, lines: receiving.length } });
  revalidatePath("/goods-receipts");
  return { id: grn.id };
}

/**
 * §9 QC + acceptance — a §19 signature (meaning RECEIVED). Accepted quantities post to the PO
 * lines; rejected quantities (reason required) leave the PO line open for a redelivery.
 * PO status auto-updates: RECEIVED when every line is fully received, else PARTIALLY_RECEIVED.
 */
async function _acceptGrn(params: { payload: GrnAcceptPayload; password: string; imageData?: string | null }) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = grnAcceptSchema.parse(params.payload);

  const grn = await db.goodsReceipt.findUnique({
    where: { id: values.grnId },
    include: { lines: { include: { poLine: { include: { item: { select: { id: true, code: true, isLotTracked: true } } } } } }, po: { include: { lines: true } } },
  });
  if (!grn) throw new Error("GRN not found.");
  await assertWarehouseKeeper(user, grn.warehouseId);
  if (grn.status !== "QC_PENDING") throw new Error("Only a QC-pending GRN can be accepted.");

  const lineById = new Map(grn.lines.map((l) => [l.id, l]));
  for (const l of values.lines) {
    const gl = lineById.get(l.grnLineId);
    if (!gl) throw new Error("QC line does not belong to this GRN.");
    const acc = new D(l.qtyAccepted), rej = new D(l.qtyRejected);
    if (!acc.plus(rej).equals(gl.qtyReceived)) {
      throw new Error(`Accepted + rejected must equal the received quantity for "${gl.poLine.description}".`);
    }
    if (rej.greaterThan(0) && !(l.rejectReason || "").trim()) {
      throw new Error("A reason is required for every rejected quantity.");
    }
  }

  const totalAccepted = values.lines.reduce((s, l) => s.plus(l.qtyAccepted), new D(0));
  const totalRejected = values.lines.reduce((s, l) => s.plus(l.qtyRejected), new D(0));

  const newStatus = totalAccepted.isZero() ? "REJECTED" : totalRejected.isZero() ? "ACCEPTED" : "PARTIALLY_REJECTED";

  // Pre-flight over-receipt check BEFORE signing: if another GRN already consumed this PO line's
  // outstanding quantity, fail now rather than strand a committed RECEIVED signature on a GRN whose
  // stock posting would later roll back. (The guarded increment inside the transaction below stays as
  // the final race-safe enforcement for the razor-thin simultaneous-commit window.)
  for (const l of values.lines) {
    if (Number(l.qtyAccepted) <= 0) continue;
    const gl = lineById.get(l.grnLineId)!;
    const pl = await db.poLine.findUnique({ where: { id: gl.poLineId }, select: { receivedQty: true, qty: true } });
    if (pl && new D(pl.receivedQty).plus(l.qtyAccepted).greaterThan(pl.qty)) {
      throw new Error(`Over-receipt: accepting ${l.qtyAccepted} for "${gl.poLine.description}" would exceed the ordered quantity (another receipt was accepted first).`);
    }
  }

  // Claim-before-sign (mirrors invoices' _verifyInvoice): atomically take the GRN out of QC_PENDING
  // BEFORE creating the RECEIVED e-signature, and release it back to QC_PENDING if signing or the
  // stock posting fails — so a concurrent acceptance can never strand an orphan RECEIVED signature on
  // a GRN whose acceptance was rolled back.
  const claim = await db.goodsReceipt.updateMany({
    where: { id: grn.id, status: "QC_PENDING" },
    data: { status: newStatus },
  });
  if (claim.count === 0) throw staleError(); // another keeper accepted this GRN first
  const releaseClaim = () =>
    db.goodsReceipt
      .updateMany({ where: { id: grn.id, status: newStatus }, data: { status: "QC_PENDING" } })
      .catch(() => {});

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      imageData: params.imageData ?? null,
      entityType: "GoodsReceipt",
      entityId: grn.id,
      meaning: "RECEIVED",
      record: {
        grnNumber: grn.grnNumber,
        po: grn.po.poNumber,
        lines: values.lines.map((l) => ({ id: l.grnLineId, a: l.qtyAccepted, r: l.qtyRejected })),
      },
    });
  } catch (e) {
    await releaseClaim();
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  await db.$transaction(async (tx) => {
    for (const l of values.lines) {
      const gl = lineById.get(l.grnLineId)!;
      await tx.grnLine.update({
        where: { id: l.grnLineId },
        data: { qtyAccepted: new D(l.qtyAccepted), qtyRejected: new D(l.qtyRejected), rejectReason: (l.rejectReason || "").trim() || null },
      });
      if (Number(l.qtyAccepted) > 0) {
        // §9 0% tolerance enforced AT ACCEPTANCE (not just creation): guarded increment so
        // two open GRNs on the same PO line can't each accept the full outstanding qty and
        // push receivedQty past the ordered qty. Only bumps when the result stays ≤ qty.
        const maxPrev = new D(gl.poLine.qty).minus(l.qtyAccepted);
        const bumped = await tx.poLine.updateMany({
          where: { id: gl.poLineId, receivedQty: { lte: maxPrev.toString() } },
          data: { receivedQty: { increment: new D(l.qtyAccepted) } },
        });
        if (bumped.count === 0) {
          throw new Error(`Over-receipt: accepting ${l.qtyAccepted} would exceed the ordered quantity for this line (another receipt was accepted first).`);
        }
        // §10b: accepted catalog items enter stock at the PO price (moving-average IN);
        // rejected quantities never enter stock. Free-text lines carry no item → no stock.
        if (gl.poLine.itemId) {
          // §21: lot-tracked items get a Lot (+ QR label barcode) at acceptance
          let lotId: string | null = null;
          if (gl.poLine.item?.isLotTracked) {
            const lotNumber = (l.lotNumber || "").trim() || (await nextLotNumber(tx));
            const lot = await tx.lot.upsert({
              where: { itemId_lotNumber: { itemId: gl.poLine.itemId, lotNumber } },
              update: {},
              create: {
                itemId: gl.poLine.itemId,
                lotNumber,
                expiryDate: l.expiryDate ? new Date(l.expiryDate + "T00:00:00") : null,
                vendorId: grn.po.vendorId,
                grnId: grn.id,
              },
            });
            lotId = lot.id;
            await tx.grnLine.update({ where: { id: gl.id }, data: { lotId } });
            const hasBarcode = await tx.barcode.findFirst({ where: { type: "LOT", lotId } });
            if (!hasBarcode) await createLotBarcode(tx, lotId, lotNumber, gl.poLine.itemId);
            await ensureItemBarcode(tx, gl.poLine.itemId, gl.poLine.item.code);
          }
          await postMovement(
            {
              type: "GRN_IN",
              warehouseId: grn.warehouseId,
              itemId: gl.poLine.itemId,
              lotId,
              qty: l.qtyAccepted,
              unitCostVnd: gl.poLine.unitPrice,
              refEntityType: "GoodsReceipt",
              refEntityId: grn.id,
              note: grn.grnNumber,
              createdById: user.id,
            },
            tx,
          );
        }
      }
    }
    // GRN status was already claimed above (QC_PENDING -> newStatus); no in-transaction flip needed.
  }).catch(async (e) => {
    await releaseClaim();   // stock posting rolled back (e.g. over-receipt race) — release the claim
    throw e;
  });

  // PO status from cumulative receipts (rejected quantities keep the line open — §9)
  const freshLines = await db.poLine.findMany({ where: { poId: grn.poId } });
  const fullyReceived = freshLines.every((l) => new D(l.receivedQty).greaterThanOrEqualTo(l.qty));
  const target = fullyReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";
  const poNow = await db.purchaseOrder.findUnique({ where: { id: grn.poId }, select: { status: true } });
  if (poNow && ["SENT", "PARTIALLY_RECEIVED"].includes(poNow.status) && poNow.status !== target) {
    if (!(await transition(db.purchaseOrder, grn.poId, poNow.status, target))) throw staleError();
  }

  await audit({
    userId: user.id,
    action: "GRN_ACCEPT",
    entityType: "GoodsReceipt",
    entityId: grn.id,
    after: { status: newStatus, accepted: String(totalAccepted), rejected: String(totalRejected), signatureId: sig.id, poStatus: target },
  });
  revalidatePath(`/goods-receipts/${grn.id}`);
  revalidatePath("/goods-receipts");
  revalidatePath(`/purchase-orders/${grn.poId}`);
  return { status: newStatus };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createGrn(...a: Parameters<typeof _createGrn>) { return guard(_createGrn, a); }
export async function acceptGrn(...a: Parameters<typeof _acceptGrn>) { return guard(_acceptGrn, a); }
