"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles, requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { vendorSchema } from "@/lib/schemas/masterdata";
import { transition, staleError } from "@/lib/workflow/transition";
import { createSteps, applyDecision, type Decision } from "@/lib/workflow/engine";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import type { SignatureMeaning } from "@prisma/client";

type FormValues = Record<string, string | boolean>;

function rethrow(e: unknown): never {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    throw new Error("That vendor code is already in use — codes must be unique.");
  }
  throw e;
}

export async function createVendor(values: FormValues) {
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

export async function updateVendor(id: string, values: FormValues) {
  const user = await requireRoles("ADMIN", "PURCHASER");
  const data = vendorSchema.parse(values);
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
    revalidatePath("/vendors");
    return { id };
  } catch (e) {
    rethrow(e);
  }
}

/* ── §7 vendor lifecycle: DRAFT → PENDING → APPROVED (Director, via the §6 engine + §19 e-sign);
   APPROVED → BLACKLISTED (reason required — blocks selection on RFQ/PO). ── */

export async function submitVendorForApproval(id: string) {
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

export async function decideVendor(params: { vendorId: string; decision: Decision; password: string; comment?: string }) {
  const user = await requireUser();
  const v = await db.vendor.findUnique({ where: { id: params.vendorId } });
  if (!v) throw new Error("Vendor not found.");
  if (v.status !== "PENDING") throw new Error("Only a pending vendor can be decided.");

  const meaning: SignatureMeaning =
    params.decision === "APPROVED" ? "APPROVED" : params.decision === "REJECTED" ? "REJECTED" : "REVIEWED";
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
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  const result = await applyDecision({
    entityType: "VENDOR",
    entityId: v.id,
    approverId: user.id,
    decision: params.decision,
    comment: params.comment,
    snapshotHash: sig.recordSnapshotHash,
    link: "/vendors",
    refLabel: `${v.code} · ${v.nameEn}`,
    requesterId: user.id,
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

export async function blacklistVendor(id: string, reason: string) {
  const user = await requireRoles("ADMIN", "DIRECTOR");
  if (!reason.trim()) throw new Error("A reason is required to blacklist a vendor.");
  const v = await db.vendor.findUnique({ where: { id } });
  if (!v) throw new Error("Vendor not found.");
  if (v.status !== "APPROVED") throw new Error("Only an approved vendor can be blacklisted.");
  if (!(await transition(db.vendor, id, "APPROVED", "BLACKLISTED"))) throw staleError();
  await audit({ userId: user.id, action: "VENDOR_BLACKLIST", entityType: "Vendor", entityId: id, after: { reason: reason.trim() } });
  revalidatePath("/vendors");
}
