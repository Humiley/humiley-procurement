"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser, requireRoles, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { createSteps, applyDecision, type Decision } from "@/lib/workflow/engine";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { payReqCreateSchema, type PayReqCreatePayload } from "@/lib/schemas/payreq";
import type { SignatureMeaning } from "@prisma/client";

const D = Prisma.Decimal;

/** §10a advance control: an unsettled PAID advance older than this blocks new advances. */
const ADVANCE_BLOCK_DAYS = 30;

async function unsettledOldAdvance(userId: string) {
  const cutoff = new Date(Date.now() - ADVANCE_BLOCK_DAYS * 24 * 3600 * 1000);
  const advances = await db.paymentRequest.findMany({
    where: { requesterId: userId, type: "ADVANCE", status: "PAID", paidDate: { lt: cutoff } },
    include: { settlements: { where: { status: { in: ["SUBMITTED", "APPROVED", "PAID"] } }, select: { id: true } } },
  });
  return advances.find((a) => a.settlements.length === 0) ?? null;
}

/** §10a: create a payment request — four types, type-specific sourcing + payee autofill. */
export async function createPaymentRequest(input: PayReqCreatePayload) {
  const user = await requireUser();
  const values = payReqCreateSchema.parse(input);

  if (values.type === "VENDOR_PAYMENT" && !hasAnyRole(user, ["ACCOUNTANT", "PURCHASER", "ADMIN"])) {
    throw new Error("Vendor payments are created by Accounting or Purchasing.");
  }
  if (!user.departmentId) throw new Error("Your account has no department — ask an admin to fix it.");

  let payeeName = user.name;
  let payeeBankName: string | null = null;
  let payeeBankAccount: string | null = null;
  let vendorId: string | null = null;
  let amount = new D(0);
  const lines: { invoiceId?: string | null; poId?: string | null; description: string; amount: Prisma.Decimal }[] = [];

  if (values.type === "VENDOR_PAYMENT") {
    const vendor = await db.vendor.findUnique({ where: { id: values.vendorId! } });
    if (!vendor) throw new Error("Vendor not found.");
    if (vendor.bankChangeFreeze) {
      throw new Error("This vendor's bank details changed recently and await Director confirmation — new payment requests are frozen (§15).");
    }
    const invoices = await db.invoice.findMany({
      where: { id: { in: values.invoiceIds! }, vendorId: vendor.id, matchStatus: "MATCHED", paymentStatus: { not: "PAID" } },
      include: { po: { select: { poNumber: true } } },
    });
    if (invoices.length !== values.invoiceIds!.length) {
      throw new Error("Every selected invoice must belong to this vendor, be MATCHED and not fully paid.");
    }
    // block invoices already carried by another live payment request
    const carried = await db.paymentRequestLine.findMany({
      where: { invoiceId: { in: invoices.map((i) => i.id) }, paymentRequest: { status: { in: ["DRAFT", "SUBMITTED", "APPROVED"] } } },
      select: { invoiceId: true },
    });
    if (carried.length) throw new Error("One of the invoices is already on another open payment request.");
    vendorId = vendor.id;
    payeeName = vendor.nameEn;
    payeeBankName = vendor.bankName;
    payeeBankAccount = vendor.bankAccount;
    for (const inv of invoices) {
      amount = amount.plus(inv.total);
      lines.push({ invoiceId: inv.id, description: `${inv.invoiceNumber} · ${inv.vendorInvoiceNo} · ${inv.po.poNumber}`, amount: inv.total });
    }
  } else if (values.type === "ADVANCE") {
    const blocked = await unsettledOldAdvance(user.id);
    if (blocked) {
      throw new Error(`You have an unsettled advance (${blocked.paymentRequestNumber}) older than ${ADVANCE_BLOCK_DAYS} days — settle it before requesting a new one.`);
    }
    const me = await db.user.findUnique({ where: { id: user.id }, select: { bankName: true, bankAccount: true } });
    payeeBankName = me?.bankName ?? null;
    payeeBankAccount = me?.bankAccount ?? null;
    amount = new D(values.amount!);
    let desc = "Advance · Tạm ứng";
    if (values.poId) {
      const po = await db.purchaseOrder.findUnique({ where: { id: values.poId }, select: { poNumber: true } });
      if (po) desc = `Advance for ${po.poNumber} · Tạm ứng theo PO`;
    }
    lines.push({ poId: values.poId ?? null, description: desc, amount });
  } else {
    // REIMBURSEMENT / ADVANCE_SETTLEMENT — free lines, payee = the requester
    const me = await db.user.findUnique({ where: { id: user.id }, select: { bankName: true, bankAccount: true } });
    payeeBankName = me?.bankName ?? null;
    payeeBankAccount = me?.bankAccount ?? null;
    if (values.type === "ADVANCE_SETTLEMENT") {
      const adv = await db.paymentRequest.findUnique({ where: { id: values.advanceRequestId! } });
      if (!adv || adv.type !== "ADVANCE" || adv.requesterId !== user.id || adv.status !== "PAID") {
        throw new Error("The settlement must reference one of YOUR paid advances.");
      }
    }
    for (const l of values.lines!) {
      const a = new D(l.amount);
      amount = amount.plus(a);
      lines.push({ description: l.description, amount: a });
    }
  }

  const preq = await db.$transaction(async (tx) => {
    const paymentRequestNumber = await nextDocNumber("PAY", tx, { prefix: "PAY" });
    return tx.paymentRequest.create({
      data: {
        paymentRequestNumber,
        type: values.type,
        requesterId: user.id,
        departmentId: user.departmentId!,
        costCenterId: values.costCenterId,
        vendorId,
        payeeName,
        payeeBankName,
        payeeBankAccount,
        amount,
        paymentMethod: values.paymentMethod,
        dueDate: values.dueDate ? new Date(values.dueDate + "T00:00:00") : null,
        reason: values.reason,
        advanceRequestId: values.type === "ADVANCE_SETTLEMENT" ? values.advanceRequestId : null,
        status: "DRAFT",
        lines: { create: lines },
      },
    });
  });

  await audit({ userId: user.id, action: "PAYREQ_CREATE", entityType: "PaymentRequest", entityId: preq.id, after: { number: preq.paymentRequestNumber, type: values.type, amount: String(amount) } });
  revalidatePath("/payment-requests");
  return { id: preq.id };
}

/** DRAFT → SUBMITTED into the §6 engine. Reimbursements must carry their receipts (§10a). */
export async function submitPaymentRequest(id: string) {
  const user = await requireUser();
  const preq = await db.paymentRequest.findUnique({ where: { id } });
  if (!preq) throw new Error("Payment request not found.");
  if (preq.requesterId !== user.id && !hasAnyRole(user, ["ADMIN"])) throw new Error("Only the requester can submit.");
  if (preq.status !== "DRAFT") throw new Error("Only a draft can be submitted.");
  if (preq.type === "REIMBURSEMENT") {
    const atts = await db.attachment.count({ where: { entityType: "PaymentRequest", entityId: id } });
    if (atts === 0) throw new Error("Attach the receipts before submitting a reimbursement.");
  }

  if (!(await transition(db.paymentRequest, id, "DRAFT", "SUBMITTED"))) throw staleError();
  try {
    await createSteps({
      entityType: "PAYMENT_REQUEST",
      entityId: id,
      amountVnd: Number(preq.amount),
      departmentId: preq.departmentId,
      requesterId: preq.requesterId,
      link: `/payment-requests/${id}`,
      refLabel: preq.paymentRequestNumber,
    });
  } catch (e) {
    await transition(db.paymentRequest, id, "SUBMITTED", "DRAFT");
    throw e;
  }
  await audit({ userId: user.id, action: "PAYREQ_SUBMIT", entityType: "PaymentRequest", entityId: id, after: { status: "SUBMITTED" } });
  revalidatePath(`/payment-requests/${id}`);
  revalidatePath("/payment-requests");
  return { id };
}

/** §10a: the mandatory ACCOUNTANT verification (invoice validity / tax compliance) — a VERIFIED signature. */
export async function verifyPaymentRequest(params: { id: string; password: string; comment?: string }) {
  const user = await requireRoles("ACCOUNTANT", "ADMIN");
  const preq = await db.paymentRequest.findUnique({ where: { id: params.id } });
  if (!preq) throw new Error("Payment request not found.");
  if (preq.status !== "SUBMITTED") throw new Error("Only a submitted payment request can be verified.");
  if (preq.verifiedById) throw new Error("Already verified.");

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "PaymentRequest",
      entityId: preq.id,
      meaning: "VERIFIED",
      reason: params.comment,
      record: { number: preq.paymentRequestNumber, type: preq.type, amount: preq.amount, payee: preq.payeeName, bank: preq.payeeBankAccount },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }
  await db.paymentRequest.update({ where: { id: preq.id }, data: { verifiedById: user.id, verifiedAt: new Date() } });
  await audit({ userId: user.id, action: "PAYREQ_VERIFY", entityType: "PaymentRequest", entityId: preq.id, after: { signatureId: sig.id } });
  revalidatePath(`/payment-requests/${preq.id}`);
  revalidatePath("/approvals");
  return { id: preq.id };
}

/** §6 + §19 decision; the FINAL approval is blocked until accounting has verified (§10a). */
export async function decidePaymentRequest(params: { id: string; decision: Decision; password: string; comment?: string }) {
  const user = await requireUser();
  const preq = await db.paymentRequest.findUnique({ where: { id: params.id } });
  if (!preq) throw new Error("Payment request not found.");
  if (preq.status !== "SUBMITTED") throw new Error("Only a submitted payment request can be decided.");

  if (params.decision === "APPROVED" && !preq.verifiedById) {
    const pending = await db.approvalStep.count({ where: { entityType: "PAYMENT_REQUEST", entityId: preq.id, status: "PENDING" } });
    if (pending <= 1) throw new Error("Accounting must verify this payment request before the final approval.");
  }

  const meaning: SignatureMeaning =
    params.decision === "APPROVED" ? "APPROVED" : params.decision === "REJECTED" ? "REJECTED" : "REVIEWED";
  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "PaymentRequest",
      entityId: preq.id,
      meaning,
      reason: params.comment,
      record: { number: preq.paymentRequestNumber, type: preq.type, amount: preq.amount, payee: preq.payeeName, status: preq.status },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  const result = await applyDecision({
    entityType: "PAYMENT_REQUEST",
    entityId: preq.id,
    approverId: user.id,
    decision: params.decision,
    comment: params.comment,
    snapshotHash: sig.recordSnapshotHash,
    link: `/payment-requests/${preq.id}`,
    refLabel: preq.paymentRequestNumber,
    requesterId: preq.requesterId,
  });

  if (result.outcome === "approved") {
    if (!(await transition(db.paymentRequest, preq.id, "SUBMITTED", "APPROVED"))) throw staleError();
  } else if (result.outcome === "rejected") {
    if (!(await transition(db.paymentRequest, preq.id, "SUBMITTED", "REJECTED"))) throw staleError();
  } else if (result.outcome === "returned") {
    if (!(await transition(db.paymentRequest, preq.id, "SUBMITTED", "DRAFT"))) throw staleError();
  }

  await audit({ userId: user.id, action: `PAYREQ_${params.decision}`, entityType: "PaymentRequest", entityId: preq.id, after: { decision: params.decision, signatureId: sig.id } });
  revalidatePath("/approvals");
  revalidatePath(`/payment-requests/${preq.id}`);
  revalidatePath("/payment-requests");
  return { outcome: result.outcome };
}

/** §10a payment execution: PAID signature + bank reference; cascades PAID to the linked invoices. */
export async function markPaymentRequestPaid(params: { id: string; password: string; paymentRef: string }) {
  const user = await requireRoles("ACCOUNTANT", "ADMIN");
  if (!params.paymentRef.trim()) throw new Error("Enter the bank/payment reference.");
  const preq = await db.paymentRequest.findUnique({ where: { id: params.id }, include: { lines: true } });
  if (!preq) throw new Error("Payment request not found.");
  if (preq.status !== "APPROVED") throw new Error("Only an approved payment request can be paid.");

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "PaymentRequest",
      entityId: preq.id,
      meaning: "PAID",
      reason: params.paymentRef.trim(),
      record: { number: preq.paymentRequestNumber, amount: preq.amount, payee: preq.payeeName, ref: params.paymentRef.trim() },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  if (!(await transition(db.paymentRequest, preq.id, "APPROVED", "PAID"))) throw staleError();
  await db.paymentRequest.update({
    where: { id: preq.id },
    data: { paidDate: new Date(), paidById: user.id, paymentRef: params.paymentRef.trim() },
  });

  // §10a cascade: every linked invoice becomes PAID
  const invoiceIds = preq.lines.map((l) => l.invoiceId).filter((v): v is string => !!v);
  if (invoiceIds.length) {
    await db.invoice.updateMany({ where: { id: { in: invoiceIds } }, data: { paymentStatus: "PAID", paidDate: new Date() } });
  }

  await audit({ userId: user.id, action: "PAYREQ_PAID", entityType: "PaymentRequest", entityId: preq.id, after: { ref: params.paymentRef.trim(), cascadedInvoices: invoiceIds.length, signatureId: sig.id } });
  revalidatePath(`/payment-requests/${preq.id}`);
  revalidatePath("/payment-requests");
  revalidatePath("/invoices");
  return { cascaded: invoiceIds.length };
}

export async function cancelPaymentRequest(id: string) {
  const user = await requireUser();
  const preq = await db.paymentRequest.findUnique({ where: { id } });
  if (!preq) throw new Error("Payment request not found.");
  const allowed = preq.requesterId === user.id || hasAnyRole(user, ["ACCOUNTANT", "ADMIN"]);
  if (!allowed) throw new Error("Not allowed.");
  if (!["DRAFT", "SUBMITTED"].includes(preq.status)) throw new Error("This payment request can no longer be cancelled.");
  if (!(await transition(db.paymentRequest, id, preq.status, "CANCELLED"))) throw staleError();
  await audit({ userId: user.id, action: "PAYREQ_CANCEL", entityType: "PaymentRequest", entityId: id, before: { status: preq.status }, after: { status: "CANCELLED" } });
  revalidatePath(`/payment-requests/${id}`);
  revalidatePath("/payment-requests");
}
