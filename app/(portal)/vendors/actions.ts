"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles, requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { vendorSchema } from "@/lib/schemas/masterdata";
import { transition, staleError } from "@/lib/workflow/transition";
import { createSteps, applyDecision, type Decision, assertCurrentApprover } from "@/lib/workflow/engine";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import type { SignatureMeaning } from "@prisma/client";
import { guard } from "@/lib/safe-action";

type FormValues = Record<string, string | boolean>;

function rethrow(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new Error("That vendor code is already in use — codes must be unique.");
  }
  throw e;
}

async function _createVendor(values: FormValues) {
  const user = await requireRoles("ADMIN", "PURCHASER");
  const data = vendorSchema.parse(values);
  try {
    const row = await db.vendor.create({
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        taxCode: data.taxCode ?? null,
        address: data.address ?? null,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        paymentTermDays: data.paymentTermDays,
        bankName: data.bankName ?? null,
        bankAccount: data.bankAccount ?? null,
        categories: data.categories,
        // status defaults to DRAFT; the vendor approval flow is Phase 5.
      },
    });
    await audit({ userId: user.id, action: "VENDOR_CREATE", entityType: "Vendor", entityId: row.id, after: { code: data.code } });
    revalidatePath("/vendors");
    return { id: row.id };
  } catch (e) {
    rethrow(e);
  }
}

async function _updateVendor(id: string, values: FormValues) {
  const user = await requireRoles("ADMIN", "PURCHASER");
  const data = vendorSchema.parse(values);
  // §15 bank-change dual control: any change to bank name/account freezes NEW payment requests
  // for this vendor until a DIRECTOR signs the confirmation, and lands in the exception register.
  const before = await db.vendor.findUnique({ where: { id }, select: { bankName: true, bankAccount: true, code: true, nameEn: true } });
  const bankChanged =
    !!before && ((before.bankName ?? "") !== (data.bankName ?? "") || (before.bankAccount ?? "") !== (data.bankAccount ?? ""));
  try {
    await db.vendor.update({
      where: { id },
      data: {
        code: data.code,
        nameEn: data.nameEn,
        nameVn: data.nameVn,
        taxCode: data.taxCode ?? null,
        address: data.address ?? null,
        contactName: data.contactName ?? null,
        contactEmail: data.contactEmail ?? null,
        contactPhone: data.contactPhone ?? null,
        paymentTermDays: data.paymentTermDays,
        bankName: data.bankName ?? null,
        bankAccount: data.bankAccount ?? null,
        categories: data.categories,
      },
    });
    await audit({ userId: user.id, action: "VENDOR_UPDATE", entityType: "Vendor", entityId: id, after: { code: data.code } });
    if (bankChanged) {
      await db.vendor.update({ where: { id }, data: { bankChangeFreeze: true } });
      await db.exception.create({
        data: {
          type: "BANK_CHANGE",
          entityType: "Vendor",
          entityId: id,
          justification: `Bank details changed by ${user.name}: ${before!.bankName ?? "—"}/${before!.bankAccount ?? "—"} → ${data.bankName ?? "—"}/${data.bankAccount ?? "—"}`,
        },
      });
      await audit({
        userId: user.id,
        action: "VENDOR_BANK_CHANGE",
        entityType: "Vendor",
        entityId: id,
        before: { bankName: before!.bankName, bankAccount: before!.bankAccount },
        after: { bankName: data.bankName ?? null, bankAccount: data.bankAccount ?? null },
      });
      const { notifyRole } = await import("@/lib/notify");
      await notifyRole("DIRECTOR", {
        titleEn: `Vendor ${before!.code} bank details changed — confirmation required`,
        titleVn: `NCC ${before!.code} đổi tài khoản ngân hàng — cần xác nhận`,
        bodyEn: `New payment requests for ${before!.nameEn} are frozen until a Director signs the confirmation. Verify by phone call-back before confirming.`,
        bodyVn: `Đề nghị thanh toán mới cho ${before!.nameEn} bị khóa đến khi Giám đốc ký xác nhận. Gọi điện xác minh trước khi xác nhận.`,
        link: "/vendors",
      });
    }
    revalidatePath("/vendors");
    return { id, bankChanged };
  } catch (e) {
    rethrow(e);
  }
}

/** §15: a DIRECTOR signs off the bank change (call-back done) — or rejects, reverting the details. */
async function _confirmVendorBank(params: { vendorId: string; approve: boolean; password: string; comment?: string; imageData?: string | null }) {
  const user = await requireRoles("DIRECTOR", "ADMIN");
  const vendor = await db.vendor.findUnique({ where: { id: params.vendorId } });
  if (!vendor) throw new Error("Vendor not found.");
  if (!vendor.bankChangeFreeze) throw new Error("No pending bank change on this vendor.");

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "VendorBankChange",
      entityId: vendor.id,
      meaning: params.approve ? "APPROVED" : "REJECTED",
      reason: params.comment,
      record: { code: vendor.code, bankName: vendor.bankName, bankAccount: vendor.bankAccount },
      imageData: params.imageData ?? null,
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  if (params.approve) {
    await db.vendor.update({ where: { id: vendor.id }, data: { bankChangeFreeze: false } });
  } else {
    // Revert to the last CONFIRMED state: the beforeJson of the EARLIEST change since the
    // last confirmation (two stacked unconfirmed changes must not revert to the first
    // unconfirmed values).
    const lastConfirm = await db.auditLog.findFirst({
      where: { entityType: "Vendor", entityId: vendor.id, action: { in: ["VENDOR_BANK_CONFIRM", "VENDOR_BANK_REJECT"] } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const changeLog = await db.auditLog.findFirst({
      where: {
        entityType: "Vendor",
        entityId: vendor.id,
        action: "VENDOR_BANK_CHANGE",
        ...(lastConfirm ? { createdAt: { gt: lastConfirm.createdAt } } : {}),
      },
      orderBy: { createdAt: "asc" },
    });
    const beforeJson = (changeLog?.beforeJson ?? {}) as { bankName?: string | null; bankAccount?: string | null };
    await db.vendor.update({
      where: { id: vendor.id },
      data: { bankName: beforeJson.bankName ?? null, bankAccount: beforeJson.bankAccount ?? null, bankChangeFreeze: false },
    });
  }
  await db.exception.updateMany({
    where: { type: "BANK_CHANGE", entityType: "Vendor", entityId: vendor.id, approvedById: null },
    data: { approvedById: user.id },
  });
  await audit({ userId: user.id, action: params.approve ? "VENDOR_BANK_CONFIRM" : "VENDOR_BANK_REJECT", entityType: "Vendor", entityId: vendor.id, after: { signatureId: sig.id } });
  revalidatePath("/vendors");
  return { id: vendor.id };
}

/* ── §7 vendor lifecycle: DRAFT → PENDING → APPROVED (Director, via the §6 engine + §19 e-sign);
   APPROVED → BLACKLISTED (reason required — blocks selection on RFQ/PO). ── */

async function _submitVendorForApproval(id: string) {
  const user = await requireRoles("ADMIN", "PURCHASER");
  const v = await db.vendor.findUnique({ where: { id } });
  if (!v) throw new Error("Vendor not found.");
  if (v.status !== "DRAFT") throw new Error("Only a draft vendor can be submitted for approval.");
  if (!(await transition(db.vendor, id, "DRAFT", "PENDING"))) throw staleError();
  try {
    await createSteps({
      entityType: "VENDOR",
      entityId: id,
      amountVnd: 0,
      departmentId: user.departmentId || "",
      requesterId: user.id,
      link: "/vendors",
      refLabel: `${v.code} · ${v.nameEn}`,
    });
  } catch (e) {
    await transition(db.vendor, id, "PENDING", "DRAFT");
    throw e;
  }
  await audit({ userId: user.id, action: "VENDOR_SUBMIT", entityType: "Vendor", entityId: id, after: { status: "PENDING" } });
  revalidatePath("/vendors");
  return { id };
}

async function _decideVendor(params: { vendorId: string; decision: Decision; password: string; comment?: string; imageData?: string | null }) {
  const user = await requireUser();
  const v = await db.vendor.findUnique({ where: { id: params.vendorId } });
  if (!v) throw new Error("Vendor not found.");
  if (v.status !== "PENDING") throw new Error("Only a pending vendor can be decided.");

  const meaning: SignatureMeaning =
    params.decision === "APPROVED" ? "APPROVED" : params.decision === "REJECTED" ? "REJECTED" : "REVIEWED";

  // §15/§19: authorization BEFORE the signature — an unauthorized caller must be refused
  // before any signature row is written (no orphan signatures).
  await assertCurrentApprover("VENDOR", v.id, user.id);

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "Vendor",
      entityId: v.id,
      meaning,
      reason: params.comment,
      record: { code: v.code, nameEn: v.nameEn, taxCode: v.taxCode, bankAccount: v.bankAccount, status: v.status },
      imageData: params.imageData ?? null,
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  // Vendor has no requester column — the outcome notification goes to whoever SUBMITTED it
  // for approval (from the audit trail), not back to the deciding director.
  const submitLog = await db.auditLog.findFirst({
    where: { entityType: "Vendor", entityId: v.id, action: "VENDOR_SUBMIT" },
    orderBy: { createdAt: "desc" },
    select: { userId: true },
  });
  const submitterId = submitLog?.userId ?? user.id;

  const result = await applyDecision({
    entityType: "VENDOR",
    entityId: v.id,
    approverId: user.id,
    decision: params.decision,
    comment: params.comment,
    snapshotHash: sig.recordSnapshotHash,
    link: "/vendors",
    refLabel: `${v.code} · ${v.nameEn}`,
    requesterId: submitterId,
  });

  if (result.outcome === "approved") {
    if (!(await transition(db.vendor, v.id, "PENDING", "APPROVED"))) throw staleError();
  } else if (result.outcome === "rejected" || result.outcome === "returned") {
    if (!(await transition(db.vendor, v.id, "PENDING", "DRAFT"))) throw staleError();
  }
  await audit({ userId: user.id, action: `VENDOR_${params.decision}`, entityType: "Vendor", entityId: v.id, after: { decision: params.decision, signatureId: sig.id } });
  revalidatePath("/vendors");
  revalidatePath("/approvals");
  return { outcome: result.outcome };
}

async function _blacklistVendor(id: string, reason: string) {
  const user = await requireRoles("ADMIN", "DIRECTOR");
  if (!reason.trim()) throw new Error("A reason is required to blacklist a vendor.");
  const v = await db.vendor.findUnique({ where: { id } });
  if (!v) throw new Error("Vendor not found.");
  if (v.status !== "APPROVED") throw new Error("Only an approved vendor can be blacklisted.");
  if (!(await transition(db.vendor, id, "APPROVED", "BLACKLISTED"))) throw staleError();
  await audit({ userId: user.id, action: "VENDOR_BLACKLIST", entityType: "Vendor", entityId: id, after: { reason: reason.trim() } });
  revalidatePath("/vendors");
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createVendor(...a: Parameters<typeof _createVendor>) { return guard(_createVendor, a); }
export async function updateVendor(...a: Parameters<typeof _updateVendor>) { return guard(_updateVendor, a); }
export async function confirmVendorBank(...a: Parameters<typeof _confirmVendorBank>) { return guard(_confirmVendorBank, a); }
export async function submitVendorForApproval(...a: Parameters<typeof _submitVendorForApproval>) { return guard(_submitVendorForApproval, a); }
export async function decideVendor(...a: Parameters<typeof _decideVendor>) { return guard(_decideVendor, a); }
export async function blacklistVendor(...a: Parameters<typeof _blacklistVendor>) { return guard(_blacklistVendor, a); }
