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

const D = Prisma.Decimal;

/** §9 GRN: WAREHOUSE receives against an open PO; over-receipt blocked (tolerance 0%). */
export async function createGrn(input: GrnCreatePayload) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = grnCreateSchema.parse(input);

  const po = await db.purchaseOrder.findUnique({ where: { id: values.poId }, include: { lines: true } });
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
export async function acceptGrn(params: { payload: GrnAcceptPayload; password: string }) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = grnAcceptSchema.parse(params.payload);

  const grn = await db.goodsReceipt.findUnique({
    where: { id: values.grnId },
    include: { lines: { include: { poLine: { include: { item: { select: { id: true } } } } } }, po: { include: { lines: true } } },
  });
  if (!grn) throw new Error("GRN not found.");
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

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
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
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  const newStatus = totalAccepted.isZero() ? "REJECTED" : totalRejected.isZero() ? "ACCEPTED" : "PARTIALLY_REJECTED";

  await db.$transaction(async (tx) => {
    for (const l of values.lines) {
      const gl = lineById.get(l.grnLineId)!;
      await tx.grnLine.update({
        where: { id: l.grnLineId },
        data: { qtyAccepted: new D(l.qtyAccepted), qtyRejected: new D(l.qtyRejected), rejectReason: (l.rejectReason || "").trim() || null },
      });
      if (Number(l.qtyAccepted) > 0) {
        await tx.poLine.update({
          where: { id: gl.poLineId },
          data: { receivedQty: new D(gl.poLine.receivedQty).plus(l.qtyAccepted) },
        });
        // §10b: accepted catalog items enter stock at the PO price (moving-average IN);
        // rejected quantities never enter stock. Free-text lines carry no item → no stock.
        if (gl.poLine.itemId) {
          await postMovement(
            {
              type: "GRN_IN",
              warehouseId: grn.warehouseId,
              itemId: gl.poLine.itemId,
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
    await tx.goodsReceipt.update({ where: { id: grn.id }, data: { status: newStatus } });
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
