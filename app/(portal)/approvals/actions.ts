"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { transition, staleError } from "@/lib/workflow/transition";
import { applyDecision, type Decision, assertCurrentApprover } from "@/lib/workflow/engine";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import type { SignatureMeaning } from "@prisma/client";
import { guard } from "@/lib/safe-action";

/**
 * §6 + §19: decide the active approval step of a PR — as an electronic signature.
 * The password re-auth, snapshot hash and hash chain happen in signRecord BEFORE the
 * decision is recorded; the engine then advances/rejects/returns and notifies.
 */
async function _decidePr(params: {
  prId: string;
  decision: Decision;
  password: string;
  comment?: string;
  imageData?: string | null;
}) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({
    where: { id: params.prId },
    include: { lines: true, requester: { select: { id: true, name: true } } },
  });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.status !== "SUBMITTED") throw new Error("Only a submitted requisition can be decided.");

  const meaning: SignatureMeaning =
    params.decision === "APPROVED" ? "APPROVED" : params.decision === "REJECTED" ? "REJECTED" : "REVIEWED";

  // §11.70 record linking: hash the document exactly as decided
  const snapshot = {
    prNumber: pr.prNumber,
    status: pr.status,
    level: pr.currentApprovalLevel,
    totalEstimatedVnd: pr.totalEstimatedVnd,
    purpose: pr.purpose,
    lines: pr.lines.map((l) => ({ item: l.itemId ?? l.freeTextDescription, qty: l.qty, price: l.estUnitPriceVnd })),
  };

    // §15/§19: authorization BEFORE the signature — an unauthorized caller must be refused
  // before any signature row is written (no orphan signatures).
  await assertCurrentApprover("PR", pr.id, user.id);

let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "PurchaseRequisition",
      entityId: pr.id,
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
    entityType: "PR",
    entityId: pr.id,
    approverId: user.id,
    decision: params.decision,
    comment: params.comment,
    snapshotHash: sig.recordSnapshotHash,
    link: `/requisitions/${pr.id}`,
    refLabel: pr.prNumber,
    requesterId: pr.requesterId,
  });

  if (result.outcome === "advance") {
    await db.purchaseRequisition.update({
      where: { id: pr.id },
      data: { currentApprovalLevel: result.nextLevel },
    });
  } else if (result.outcome === "approved") {
    if (!(await transition(db.purchaseRequisition, pr.id, "SUBMITTED", "APPROVED"))) throw staleError();
    try { const { commitPr } = await import("@/lib/budget"); await commitPr(pr.id); } catch (e) { console.warn("budget commit failed:", e); }   // §9: approval commits the budget
  } else if (result.outcome === "rejected") {
    if (!(await transition(db.purchaseRequisition, pr.id, "SUBMITTED", "REJECTED"))) throw staleError();
  } else {
    if (!(await transition(db.purchaseRequisition, pr.id, "SUBMITTED", "DRAFT"))) throw staleError();
    await db.purchaseRequisition.update({ where: { id: pr.id }, data: { currentApprovalLevel: 0 } });
  }

  await audit({
    userId: user.id,
    action: `PR_${params.decision}`,
    entityType: "PurchaseRequisition",
    entityId: pr.id,
    after: { decision: params.decision, signatureId: sig.id, comment: params.comment || null },
  });

  revalidatePath("/approvals");
  revalidatePath(`/requisitions/${pr.id}`);
  revalidatePath("/requisitions");
  return { outcome: result.outcome };
}

async function _markNotificationRead(id: string) {
  const user = await requireUser();
  await db.notification.updateMany({ where: { id, userId: user.id }, data: { isRead: true } });
  revalidatePath("/notifications");
}

async function _markAllNotificationsRead() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, isRead: false }, data: { isRead: true } });
  revalidatePath("/notifications");
}

/** One dispatcher for the queue: route a decision to the entity's decide action. */
async function _decideEntity(params: {
  entityType: "PR" | "PO" | "VENDOR" | "PAYMENT_REQUEST" | "GOODS_ISSUE";
  entityId: string;
  decision: Decision;
  password: string;
  comment?: string;
  imageData?: string | null;
}) {
  if (params.entityType === "PR") {
    return _decidePr({ prId: params.entityId, decision: params.decision, password: params.password, comment: params.comment, imageData: params.imageData });
  }
  if (params.entityType === "PO") {
    const { decidePo } = await import("@/app/(portal)/purchase-orders/actions");
    return decidePo({ poId: params.entityId, decision: params.decision, password: params.password, comment: params.comment, imageData: params.imageData });
  }
  if (params.entityType === "PAYMENT_REQUEST") {
    const { decidePaymentRequest } = await import("@/app/(portal)/payment-requests/actions");
    return decidePaymentRequest({ id: params.entityId, decision: params.decision, password: params.password, comment: params.comment, imageData: params.imageData });
  }
  if (params.entityType === "GOODS_ISSUE") {
    const { decideGoodsIssue } = await import("@/app/(portal)/inventory/issues/actions");
    return decideGoodsIssue({ id: params.entityId, decision: params.decision, password: params.password, comment: params.comment, imageData: params.imageData });
  }
  const { decideVendor } = await import("@/app/(portal)/vendors/actions");
  return decideVendor({ vendorId: params.entityId, decision: params.decision, password: params.password, comment: params.comment, imageData: params.imageData });
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function decidePr(...a: Parameters<typeof _decidePr>) { return guard(_decidePr, a); }
export async function markNotificationRead(...a: Parameters<typeof _markNotificationRead>) { return guard(_markNotificationRead, a); }
export async function markAllNotificationsRead(...a: Parameters<typeof _markAllNotificationsRead>) { return guard(_markAllNotificationsRead, a); }
export async function decideEntity(...a: Parameters<typeof _decideEntity>) { return guard(_decideEntity, a); }
