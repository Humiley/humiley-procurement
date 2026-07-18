"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles, requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { createSteps, applyDecision, type Decision, assertCurrentApprover } from "@/lib/workflow/engine";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { sendMailRaw } from "@/lib/notify";
import { poCreateSchema, type PoFormPayload } from "@/lib/schemas/po";
import type { SignatureMeaning } from "@prisma/client";
import { guard } from "@/lib/safe-action";

function computeTotals(lines: { qty: string; unitPrice: string }[], vatPct: string) {
  const subtotal = lines
    .reduce((s, l) => s.plus(new Prisma.Decimal(l.qty).times(l.unitPrice)), new Prisma.Decimal(0))
    .toDecimalPlaces(2);
  const vatAmount = subtotal.times(vatPct).div(100).toDecimalPlaces(2);
  return { subtotal, vatAmount, total: subtotal.plus(vatAmount) };
}

/** §8: create a PO — from an APPROVED PR (lines prefilled) or standalone. PURCHASER/ADMIN only. */
async function _createPo(input: PoFormPayload) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const values = poCreateSchema.parse(input);

  const vendor = await db.vendor.findUnique({ where: { id: values.vendorId } });
  if (!vendor) throw new Error("Vendor not found.");
  if (vendor.status !== "APPROVED") throw new Error("Only an APPROVED vendor can receive a purchase order.");

  let pr = null;
  if (values.prId) {
    pr = await db.purchaseRequisition.findUnique({ where: { id: values.prId }, include: { lines: { select: { id: true } } } });
    if (!pr) throw new Error("Source requisition not found.");
    if (pr.status !== "APPROVED") throw new Error("Only an APPROVED requisition can be converted to a PO.");
    // every referenced prLineId must belong to THIS requisition
    const prLineIds = new Set(pr.lines.map((l) => l.id));
    for (const l of values.lines) {
      if (l.prLineId && !prLineIds.has(l.prLineId)) throw new Error("A line references a different requisition.");
    }
  } else {
    for (const l of values.lines) if (l.prLineId) throw new Error("A line references a requisition but none was given.");
  }

  const { subtotal, vatAmount, total } = computeTotals(values.lines, values.vatPct);

  // §9 contracts: an ACTIVE in-validity framework agreement auto-links; contracted-price
  // deviations are flagged in the audit trail (and live on the PO detail).
  const now = new Date();
  const contract = await db.contract.findFirst({
    where: { vendorId: vendor.id, status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } },
  });
  const contractPrices = (contract?.priceListJson ?? {}) as Record<string, string>;
  const priceDeviations = values.lines
    .filter((l) => l.itemId && contractPrices[l.itemId] && Number(l.unitPrice) !== Number(contractPrices[l.itemId]))
    .map((l) => ({ itemId: l.itemId!, contractPrice: contractPrices[l.itemId!], poPrice: String(l.unitPrice) }));

  const po = await db.$transaction(async (tx) => {
    const poNumber = await nextDocNumber("PO", tx, { prefix: "PO" });
    // Consume the source PR (guarded) INSIDE the same transaction as the PO create, so a failed create
    // never strands the PR at CONVERTED with a leaked budget commitment — both commit or neither does.
    if (pr && !(await transition(tx.purchaseRequisition, pr.id, "APPROVED", "CONVERTED"))) {
      throw new Error("This requisition was just converted by someone else.");
    }
    const created = await tx.purchaseOrder.create({
      data: {
        poNumber,
        vendorId: vendor.id,
        prId: pr?.id ?? null,
        contractId: contract?.id ?? null,
        quoteId: values.quoteId ?? null,
        currency: values.currency.toUpperCase(),
        fxRate: new Prisma.Decimal(values.fxRate),
        paymentTerms: values.paymentTerms || null,
        incoterm: values.incoterm || null,
        incotermPlace: values.incotermPlace || null,
        deliveryAddress: values.deliveryAddress || null,
        expectedDate: values.expectedDate ? new Date(values.expectedDate + "T00:00:00") : null,
        warrantyTerms: values.warrantyTerms || null,
        status: "DRAFT",
        subtotal,
        vatPct: new Prisma.Decimal(values.vatPct),
        vatAmount,
        total,
        createdById: user.id,
        lines: {
          create: values.lines.map((l) => ({
            prLineId: l.prLineId || null,
            itemId: l.itemId || null,
            description: l.description,
            uomId: l.uomId,
            qty: new Prisma.Decimal(l.qty),
            unitPrice: new Prisma.Decimal(l.unitPrice),
            amount: new Prisma.Decimal(l.qty).times(l.unitPrice).toDecimalPlaces(2),
            isCapex: l.isCapex ?? false,
          })),
        },
      },
    });
    return created;
  });


  await audit({
    userId: user.id,
    action: "PO_CREATE",
    entityType: "PurchaseOrder",
    entityId: po.id,
    after: { poNumber: po.poNumber, vendor: vendor.code, prId: pr?.id ?? null, total: String(total) , contractId: contract?.id ?? null, priceDeviations },
  });
  revalidatePath("/purchase-orders");
  if (pr) revalidatePath(`/requisitions/${pr.id}`);
  return { id: po.id };
}

/** Submit a draft PO into the §6 approval chain (same amount bands, entityType PO). */
async function _submitPo(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const po = await db.purchaseOrder.findUnique({
    where: { id },
    include: { pr: { select: { departmentId: true } }, _count: { select: { lines: true } } },
  });
  if (!po) throw new Error("Purchase order not found.");
  if (po.status !== "DRAFT") throw new Error("Only a draft PO can be submitted.");
  if (po._count.lines === 0) throw new Error("Add at least one line before submitting.");

  if (!(await transition(db.purchaseOrder, id, "DRAFT", "PENDING_APPROVAL"))) throw staleError();
  try {
    await createSteps({
      entityType: "PO",
      entityId: id,
      amountVnd: Number(po.total) * Number(po.fxRate),   // §6 bands are VND — convert foreign-currency totals
      departmentId: po.pr?.departmentId || user.departmentId || "",
      requesterId: po.createdById || user.id,
      link: `/purchase-orders/${id}`,
      refLabel: po.poNumber,
    });
  } catch (e) {
    await transition(db.purchaseOrder, id, "PENDING_APPROVAL", "DRAFT");
    throw e;
  }
  await audit({ userId: user.id, action: "PO_SUBMIT", entityType: "PurchaseOrder", entityId: id, after: { status: "PENDING_APPROVAL" } });
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  return { id };
}

/** §6 + §19: sign-then-decide the active PO approval step. */
async function _decidePo(params: { poId: string; decision: Decision; password: string; comment?: string; imageData?: string | null }) {
  const user = await requireUser();
  const po = await db.purchaseOrder.findUnique({
    where: { id: params.poId },
    include: { lines: true, vendor: { select: { code: true } } },
  });
  if (!po) throw new Error("Purchase order not found.");
  if (po.status !== "PENDING_APPROVAL") throw new Error("Only a PO pending approval can be decided.");

  const meaning: SignatureMeaning =
    params.decision === "APPROVED" ? "APPROVED" : params.decision === "REJECTED" ? "REJECTED" : "REVIEWED";
  const snapshot = {
    poNumber: po.poNumber,
    vendor: po.vendor.code,
    status: po.status,
    total: po.total,
    vatPct: po.vatPct,
    lines: po.lines.map((l) => ({ d: l.description, q: l.qty, p: l.unitPrice })),
  };

    // §15/§19: authorization BEFORE the signature — an unauthorized caller must be refused
  // before any signature row is written (no orphan signatures).
  await assertCurrentApprover("PO", po.id, user.id);

let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "PurchaseOrder",
      entityId: po.id,
      meaning,
      reason: params.comment,
      record: snapshot,
      imageData: params.imageData ?? null,
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  const result = await applyDecision({
    entityType: "PO",
    entityId: po.id,
    approverId: user.id,
    decision: params.decision,
    comment: params.comment,
    snapshotHash: sig.recordSnapshotHash,
    link: `/purchase-orders/${po.id}`,
    refLabel: po.poNumber,
    requesterId: po.createdById || user.id,
  });

  if (result.outcome === "approved") {
    if (!(await transition(db.purchaseOrder, po.id, "PENDING_APPROVAL", "APPROVED"))) throw staleError();
    const { fireWebhook } = await import("@/lib/webhooks");
    await fireWebhook("po.approved", { poId: po.id, poNumber: po.poNumber, total: String(po.total), vendorId: po.vendorId });
    try { const { moveCommitmentPrToPo } = await import("@/lib/budget"); await moveCommitmentPrToPo(po.id); } catch (e) { console.warn("budget move failed:", e); }   // §9: commitment moves PR→PO
  } else if (result.outcome === "rejected" || result.outcome === "returned") {
    // PoStatus has no REJECTED — both decisions send the PO back to DRAFT with the comment + audit trail.
    if (!(await transition(db.purchaseOrder, po.id, "PENDING_APPROVAL", "DRAFT"))) throw staleError();
  }

  await audit({
    userId: user.id,
    action: `PO_${params.decision}`,
    entityType: "PurchaseOrder",
    entityId: po.id,
    after: { decision: params.decision, signatureId: sig.id, comment: params.comment || null },
  });
  revalidatePath("/approvals");
  revalidatePath(`/purchase-orders/${po.id}`);
  revalidatePath("/purchase-orders");
  return { outcome: result.outcome };
}

/** §8: APPROVED → SENT — emails the branded PDF to the vendor, CC the purchaser. */
async function _sendPo(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { vendor: true, createdBy: { select: { email: true } } } });
  if (!po) throw new Error("Purchase order not found.");
  if (po.status !== "APPROVED") throw new Error("Only an approved PO can be sent.");

  if (!(await transition(db.purchaseOrder, id, "APPROVED", "SENT"))) throw staleError();

  try {
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const React = (await import("react")).default;
    const { poPdfData } = await import("@/lib/pdf/po-data");
    const { PoPdf } = await import("@/lib/pdf/PoPdf");
    const data = await poPdfData(id);
    if (data && po.vendor.contactEmail) {
      const buf = await renderToBuffer(React.createElement(PoPdf, { d: data }) as never);
      await sendMailRaw({
        to: po.vendor.contactEmail,
        cc: po.createdBy?.email || user.email,
        subject: `Purchase Order ${po.poNumber} — Humiley Engineering & Solutions`,
        text:
          `Dear ${po.vendor.contactName || po.vendor.nameEn},\n\n` +
          `Please find attached our purchase order ${po.poNumber}.\n` +
          `Kindly confirm receipt and the expected delivery date.\n\n` +
          `Best regards,\nHumiley Procurement`,
        attachments: [{ filename: `${po.poNumber}.pdf`, content: buf }],
      });
    }
  } catch (e) {
    console.warn("PO send email failed:", e instanceof Error ? e.message : e);
  }

  await audit({ userId: user.id, action: "PO_SEND", entityType: "PurchaseOrder", entityId: id, after: { status: "SENT", vendorEmail: po.vendor.contactEmail || null } });
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
  return { id };
}

/** Manual close / cancel (§8) — cancel is blocked once any GRN exists. */
async function _cancelPo(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const po = await db.purchaseOrder.findUnique({ where: { id }, include: { _count: { select: { goodsReceipts: true } } } });
  if (!po) throw new Error("Purchase order not found.");
  if (po._count.goodsReceipts > 0) throw new Error("Cannot cancel — goods have already been received against this PO.");
  if (!["DRAFT", "APPROVED", "SENT"].includes(po.status)) throw new Error("This PO can no longer be cancelled.");
  if (!(await transition(db.purchaseOrder, id, po.status, "CANCELLED"))) throw staleError();
  // Release the budget commitment placed while this PO was live — otherwise it is stranded forever and
  // blocks future requisitions against that budget line. APPROVED/SENT: the commitment is in PO form
  // (release ordered − invoiced, = full when no goods received, which cancel requires). Still-DRAFT
  // PR-sourced: moveCommitmentPrToPo never ran, so reverse the source PR's estimate commitment.
  try {
    if (po.status === "APPROVED" || po.status === "SENT") {
      const { releaseOnPoClose } = await import("@/lib/budget");
      await releaseOnPoClose(id);
    } else if (po.status === "DRAFT" && po.prId) {
      const { commitPr } = await import("@/lib/budget");
      await commitPr(po.prId, -1);
    }
  } catch (e) {
    console.warn("budget release on cancel failed:", e);
  }
  await audit({ userId: user.id, action: "PO_CANCEL", entityType: "PurchaseOrder", entityId: id, before: { status: po.status }, after: { status: "CANCELLED" } });
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
}

async function _closePo(id: string) {
  const user = await requireRoles("PURCHASER", "ADMIN");
  const po = await db.purchaseOrder.findUnique({ where: { id } });
  if (!po) throw new Error("Purchase order not found.");
  if (!["SENT", "PARTIALLY_RECEIVED", "RECEIVED"].includes(po.status)) throw new Error("Only a sent/received PO can be closed.");
  if (!(await transition(db.purchaseOrder, id, po.status, "CLOSED"))) throw staleError();
  try { const { releaseOnPoClose } = await import("@/lib/budget"); await releaseOnPoClose(id); } catch (e) { console.warn("budget release failed:", e); }   // §9: closing releases remaining commitment
  await audit({ userId: user.id, action: "PO_CLOSE", entityType: "PurchaseOrder", entityId: id, before: { status: po.status }, after: { status: "CLOSED" } });
  revalidatePath(`/purchase-orders/${id}`);
  revalidatePath("/purchase-orders");
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createPo(...a: Parameters<typeof _createPo>) { return guard(_createPo, a); }
export async function submitPo(...a: Parameters<typeof _submitPo>) { return guard(_submitPo, a); }
export async function decidePo(...a: Parameters<typeof _decidePo>) { return guard(_decidePo, a); }
export async function sendPo(...a: Parameters<typeof _sendPo>) { return guard(_sendPo, a); }
export async function cancelPo(...a: Parameters<typeof _cancelPo>) { return guard(_cancelPo, a); }
export async function closePo(...a: Parameters<typeof _closePo>) { return guard(_closePo, a); }
