"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import type { Role, ApprovalEntityType } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import { verifyChain } from "@/lib/esign/sign";
import { guard } from "@/lib/safe-action";

const D = Prisma.Decimal;

/* ── §6/§15 approval-matrix admin (audited CRUD; versioning logged as future work) ── */

const matrixRowSchema = z.object({
  entityType: z.enum(["PR", "PO", "VENDOR", "CONTRACT", "INVOICE", "PAYMENT_REQUEST", "GOODS_ISSUE", "STOCK_COUNT"]),
  minAmountVnd: z.string().trim().regex(/^\d+$/),
  maxAmountVnd: z.string().trim().regex(/^\d*$/).optional().nullable(),
  level: z.coerce.number().int().min(1).max(5),
  approverRole: z.enum(["DEPT_MANAGER", "DIRECTOR", "ACCOUNTANT", "PURCHASER", "WAREHOUSE", "ADMIN"]),
});
export type MatrixRowPayload = z.input<typeof matrixRowSchema>;

async function _addMatrixRow(input: MatrixRowPayload) {
  const admin = await requireRoles("ADMIN");
  const v = matrixRowSchema.parse(input);
  const row = await db.approvalMatrix.create({
    data: {
      entityType: v.entityType as ApprovalEntityType,
      minAmountVnd: new D(v.minAmountVnd),
      maxAmountVnd: v.maxAmountVnd ? new D(v.maxAmountVnd) : null,
      level: v.level,
      approverRole: v.approverRole as Role,
    },
  });
  await audit({ userId: admin.id, action: "MATRIX_ADD", entityType: "ApprovalMatrix", entityId: row.id, after: v });
  revalidatePath("/admin/approval-matrix");
  return { id: row.id };
}

async function _deleteMatrixRow(id: string) {
  const admin = await requireRoles("ADMIN");
  const row = await db.approvalMatrix.delete({ where: { id } });
  await audit({
    userId: admin.id,
    action: "MATRIX_DELETE",
    entityType: "ApprovalMatrix",
    entityId: id,
    before: { entityType: row.entityType, level: row.level, approverRole: row.approverRole, min: String(row.minAmountVnd), max: row.maxAmountVnd ? String(row.maxAmountVnd) : null },
  });
  revalidatePath("/admin/approval-matrix");
  return { id };
}

/* ── §15 delegation: ADMIN reassigns a PENDING approval step (audited, approver notified) ── */

async function _reassignStep(params: { stepId: string; newApproverId: string }) {
  const admin = await requireRoles("ADMIN");
  const step = await db.approvalStep.findUnique({ where: { id: params.stepId }, include: { approver: { select: { name: true } } } });
  if (!step) throw new Error("Approval step not found.");
  if (step.status !== "PENDING") throw new Error("Only a pending step can be reassigned.");
  const target = await db.user.findUnique({ where: { id: params.newApproverId } });
  if (!target || !target.isActive) throw new Error("Target approver not found or inactive.");
  if (target.id === step.approverId) throw new Error("The step is already assigned to that user.");

  // §15 hard rule survives delegation: never hand a step to the document's own requester.
  const requesterByType: Record<string, () => Promise<string | null>> = {
    PR: async () => (await db.purchaseRequisition.findUnique({ where: { id: step.entityId }, select: { requesterId: true } }))?.requesterId ?? null,
    PO: async () => (await db.purchaseOrder.findUnique({ where: { id: step.entityId }, select: { createdById: true } }))?.createdById ?? null,
    PAYMENT_REQUEST: async () => (await db.paymentRequest.findUnique({ where: { id: step.entityId }, select: { requesterId: true } }))?.requesterId ?? null,
    GOODS_ISSUE: async () => (await db.goodsIssue.findUnique({ where: { id: step.entityId }, select: { requesterId: true } }))?.requesterId ?? null,
  };
  const requesterId = await (requesterByType[step.entityType]?.() ?? Promise.resolve(null));
  if (requesterId && requesterId === target.id) {
    throw new Error("Segregation of duties: a step cannot be delegated to the document's requester (§15).");
  }

  // delegation provenance stays on the step itself (visible in every approval timeline)
  const provenance = `Delegated from ${step.approver.name} by ${admin.name}`;
  await db.approvalStep.update({
    where: { id: step.id },
    data: { approverId: target.id, comment: step.comment ? `${step.comment} · ${provenance}` : provenance },
  });
  await audit({
    userId: admin.id,
    action: "STEP_REASSIGN",
    entityType: "ApprovalStep",
    entityId: step.id,
    before: { approver: step.approver.name },
    after: { approver: target.name, entity: `${step.entityType}:${step.entityId}`, level: step.level },
  });
  await notifyUser(target.id, {
    titleEn: `An approval was delegated to you (${step.entityType}, level ${step.level})`,
    titleVn: `Một phê duyệt được ủy quyền cho bạn (${step.entityType}, cấp ${step.level})`,
    link: "/approvals",
  });
  revalidatePath("/admin/approval-matrix");
  revalidatePath("/approvals");
  return { id: step.id };
}

/* ── §19 signature-chain integrity sweep (every entity's chain re-computed) ── */

export type IntegrityResult = {
  chains: number;
  signatures: number;
  broken: { entityType: string; entityId: string; brokenAt: string }[];
  checkedAt: string;
};

async function _verifyAllChains(): Promise<IntegrityResult> {
  const admin = await requireRoles("ADMIN");
  const groups = await db.electronicSignature.groupBy({ by: ["entityType", "entityId"], _count: { id: true } });
  const broken: IntegrityResult["broken"] = [];
  let signatures = 0;
  for (const g of groups) {
    signatures += g._count.id;
    const res = await verifyChain(g.entityType, g.entityId);
    if (!res.ok) broken.push({ entityType: g.entityType, entityId: g.entityId, brokenAt: res.brokenAt });
  }
  const result: IntegrityResult = { chains: groups.length, signatures, broken, checkedAt: new Date().toISOString() };
  await audit({ userId: admin.id, action: "CHAIN_VERIFY", entityType: "ElectronicSignature", entityId: "ALL", after: { chains: result.chains, signatures, broken: broken.length } });
  return result;
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function addMatrixRow(...a: Parameters<typeof _addMatrixRow>) { return guard(_addMatrixRow, a); }
export async function deleteMatrixRow(...a: Parameters<typeof _deleteMatrixRow>) { return guard(_deleteMatrixRow, a); }
export async function reassignStep(...a: Parameters<typeof _reassignStep>) { return guard(_reassignStep, a); }
export async function verifyAllChains(...a: Parameters<typeof _verifyAllChains>) { return guard(_verifyAllChains, a); }
