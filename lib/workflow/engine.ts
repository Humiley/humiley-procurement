import "server-only";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notifyUser } from "@/lib/notify";
import type { ApprovalEntityType, ApprovalStepStatus, Role } from "@prisma/client";

/**
 * §6 approval engine — generic over ApprovalEntityType (PR now; PO/vendor/contract/… reuse it).
 *
 * - The admin-configurable ApprovalMatrix maps (entityType, amount band) → sequential levels
 *   (1 = Department Manager, 2 = Director, 3 = Managing Director by default seed).
 * - `createSteps` resolves each level to a concrete approver and creates PENDING steps.
 * - **No self-approval (hard rule):** if a level resolves to the requester, the engine skips to
 *   the next eligible approver of the same level and writes an audit entry.
 * - `applyDecision` advances / rejects / returns, keeps `currentApprovalLevel` on the entity in
 *   sync, and notifies the next actor — the caller performs the e-signature FIRST (§19), then
 *   records the decision here with the signature's snapshot hash.
 */

export const LEVEL_LABELS: Record<number, string> = {
  1: "Department Manager",
  2: "Director",
  3: "Managing Director",
};

const SLA_BUSINESS_DAYS = 2;

function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) left--;
  }
  return d;
}

/** Resolve the concrete approver for one matrix row, honouring no-self-approval. */
async function resolveApprover(row: {
  approverUserId: string | null;
  approverRole: Role | null;
  level: number;
}, ctx: { departmentId: string; requesterId: string; entityType: ApprovalEntityType; entityId: string }) {
  const eligible: { id: string; name: string }[] = [];

  if (row.approverUserId) {
    const u = await db.user.findUnique({ where: { id: row.approverUserId }, select: { id: true, name: true, isActive: true } });
    if (u && u.isActive) eligible.push({ id: u.id, name: u.name });
  } else if (row.approverRole === "DEPT_MANAGER") {
    // the manager OF the document's department first, then any other department manager
    const dept = await db.department.findUnique({
      where: { id: ctx.departmentId },
      select: { managerId: true },
    });
    const candidates = await db.user.findMany({
      where: { isActive: true, roles: { has: "DEPT_MANAGER" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    candidates.sort((a, b) => Number(b.id === dept?.managerId) - Number(a.id === dept?.managerId));
    eligible.push(...candidates);
  } else if (row.approverRole === "DIRECTOR") {
    // level 3 prefers the Managing Director (isChief among directors); level 2 prefers a non-chief director
    const dirs = await db.user.findMany({
      where: { isActive: true, roles: { has: "DIRECTOR" } },
      select: { id: true, name: true, isChief: true },
      orderBy: { name: "asc" },
    });
    const preferChief = row.level >= 3;
    dirs.sort((a, b) => Number(preferChief ? b.isChief : !b.isChief) - Number(preferChief ? a.isChief : !a.isChief));
    eligible.push(...dirs.map((d) => ({ id: d.id, name: d.name })));
  } else if (row.approverRole === "ACCOUNTANT") {
    // §10a: the Chief Accountant (isChief) signs payment-request approvals first
    const accts = await db.user.findMany({
      where: { isActive: true, roles: { has: "ACCOUNTANT" } },
      select: { id: true, name: true, isChief: true },
      orderBy: { name: "asc" },
    });
    accts.sort((a, b) => Number(b.isChief) - Number(a.isChief));
    eligible.push(...accts.map((u) => ({ id: u.id, name: u.name })));
  } else if (row.approverRole) {
    const users = await db.user.findMany({
      where: { isActive: true, roles: { has: row.approverRole } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
    eligible.push(...users);
  }

  const firstChoice = eligible[0];
  const pick = eligible.find((u) => u.id !== ctx.requesterId);   // hard rule: never the requester
  if (firstChoice && pick && firstChoice.id !== pick.id) {
    await audit({
      userId: null,
      action: "APPROVAL_SELF_SKIP",
      entityType: ctx.entityType,
      entityId: ctx.entityId,
      after: { level: row.level, skipped: firstChoice.id, pickedInstead: pick.id },
    });
  }
  return pick ?? null;
}

/**
 * Build the sequential approval steps for an entity from the matrix and activate level 1.
 * Returns the created steps (level-ordered). Throws when no matrix band matches.
 */
export async function createSteps(params: {
  entityType: ApprovalEntityType;
  entityId: string;
  amountVnd: number;
  departmentId: string;
  requesterId: string;
  link: string; // in-app link for notifications, e.g. /requisitions/<id>
  refLabel: string; // e.g. PR-2026-00012
}) {
  // Match by minAmountVnd only and prefer the TIGHTEST band per level (greatest min ≤ amount).
  // Matching min..max as an interval left 1-VND gaps between seeded bands (e.g. an amount of
  // 19,999,999.50 matched nothing) — resolving by min is gap-free by construction, and the
  // tightest band containing the amount is always the intended one.
  const rows = await db.approvalMatrix.findMany({
    where: {
      entityType: params.entityType,
      isActive: true,
      minAmountVnd: { lte: params.amountVnd },
    },
    orderBy: { level: "asc" },
  });
  if (rows.length === 0) {
    throw new Error("No approval matrix band matches this amount — ask an admin to configure the matrix.");
  }

  const bandMin = rows.reduce((m, r) => (Number(r.minAmountVnd) > m ? Number(r.minAmountVnd) : m), 0);
  const inBand = rows.filter((r) => Number(r.minAmountVnd) === bandMin);
  // one step per distinct level (matrix may hold dept-scoped variants — prefer dept match)
  const byLevel = new Map<number, (typeof rows)[number]>();
  for (const r of inBand) {
    const cur = byLevel.get(r.level);
    if (!cur || (r.departmentId === params.departmentId && cur.departmentId !== params.departmentId)) {
      byLevel.set(r.level, r);
    }
  }

  // resolve every approver first, then create ALL steps in one transaction — a mid-chain
  // resolution failure must not strand a partial PENDING chain on the document
  const resolved: { level: number; approverId: string }[] = [];
  for (const [level, row] of Array.from(byLevel.entries()).sort((a, b) => a[0] - b[0])) {
    const approver = await resolveApprover(
      { approverUserId: row.approverUserId, approverRole: row.approverRole, level },
      { departmentId: params.departmentId, requesterId: params.requesterId, entityType: params.entityType, entityId: params.entityId },
    );
    if (!approver) throw new Error(`No eligible approver found for level ${level} (${LEVEL_LABELS[level] || "level " + level}).`);
    resolved.push({ level, approverId: approver.id });
  }
  const steps = await db.$transaction(
    resolved.map((r) =>
      db.approvalStep.create({
        data: {
          entityType: params.entityType,
          entityId: params.entityId,
          level: r.level,
          approverId: r.approverId,
          status: "PENDING",
          slaDueAt: addBusinessDays(new Date(), SLA_BUSINESS_DAYS),
        },
      }),
    ),
  );

  // hand the document to level 1
  const first = steps[0];
  await notifyUser(first.approverId, {
    titleEn: `Approval needed: ${params.refLabel}`,
    titleVn: `Cần phê duyệt: ${params.refLabel}`,
    bodyEn: `A document is waiting for your approval (level ${first.level} — ${LEVEL_LABELS[first.level] || ""}).`,
    bodyVn: `Một chứng từ đang chờ bạn phê duyệt (cấp ${first.level} — ${LEVEL_LABELS[first.level] || ""}).`,
    link: params.link,
  });
  return steps;
}

export type Decision = "APPROVED" | "REJECTED" | "RETURNED";

/**
 * §19 order-of-operations guard: decide actions call this BEFORE signRecord so an
 * unauthorized caller is refused before any signature row is written (no orphan
 * signatures, no unauthorized signing). applyDecision re-checks afterwards.
 */
export async function assertCurrentApprover(entityType: ApprovalEntityType, entityId: string, userId: string) {
  const active = await db.approvalStep.findFirst({
    where: { entityType, entityId, status: "PENDING" },
    orderBy: { level: "asc" },
  });
  if (!active) throw new Error("Nothing is waiting for approval on this document.");
  if (active.approverId !== userId) {
    throw new Error("This document is waiting for a different approver at the current level.");
  }
  return active;
}

/**
 * Record a decision on the entity's ACTIVE step (the pending step at the lowest level).
 * The caller must have signed already (§19) and passes the signature's snapshot hash.
 * Returns what the caller must do to the entity: 'advance' (next level notified),
 * 'approved' (all levels done), 'rejected', or 'returned'.
 */
export async function applyDecision(params: {
  entityType: ApprovalEntityType;
  entityId: string;
  approverId: string;
  decision: Decision;
  comment?: string | null;
  snapshotHash: string;
  link: string;
  refLabel: string;
  requesterId: string;
}): Promise<{ outcome: "advance" | "approved" | "rejected" | "returned"; nextLevel?: number }> {
  const pending = await db.approvalStep.findMany({
    where: { entityType: params.entityType, entityId: params.entityId, status: "PENDING" },
    orderBy: { level: "asc" },
  });
  const active = pending[0];
  if (!active) throw new Error("Nothing is waiting for approval on this document.");
  if (active.approverId !== params.approverId) {
    throw new Error("This document is waiting for a different approver at the current level.");
  }
  if (params.decision !== "APPROVED" && !(params.comment || "").trim()) {
    throw new Error("A comment is required to reject or return a document.");
  }

  const decided = await db.approvalStep.updateMany({
    where: { id: active.id, status: "PENDING" },
    data: {
      status: params.decision as ApprovalStepStatus,
      decidedAt: new Date(),
      comment: (params.comment || "").trim() || null,
      snapshotHash: params.snapshotHash,
    },
  });
  if (decided.count === 0) {
    throw new Error("This step was already decided by a concurrent action — reload the document.");
  }

  if (params.decision === "APPROVED") {
    const next = pending[1];
    if (next) {
      await notifyUser(next.approverId, {
        titleEn: `Approval needed: ${params.refLabel}`,
        titleVn: `Cần phê duyệt: ${params.refLabel}`,
        bodyEn: `Level ${active.level} approved — the document is now at level ${next.level} (${LEVEL_LABELS[next.level] || ""}).`,
        bodyVn: `Cấp ${active.level} đã duyệt — chứng từ đang ở cấp ${next.level} (${LEVEL_LABELS[next.level] || ""}).`,
        link: params.link,
      });
      return { outcome: "advance", nextLevel: next.level };
    }
    await notifyUser(params.requesterId, {
      titleEn: `Approved: ${params.refLabel}`,
      titleVn: `Đã phê duyệt: ${params.refLabel}`,
      bodyEn: "All approval levels are complete.",
      bodyVn: "Tất cả các cấp phê duyệt đã hoàn tất.",
      link: params.link,
    });
    return { outcome: "approved" };
  }

  // REJECTED / RETURNED — remove the not-yet-actioned later steps
  const laterIds = pending.slice(1).map((s) => s.id);
  if (laterIds.length) await db.approvalStep.deleteMany({ where: { id: { in: laterIds } } });

  await notifyUser(params.requesterId, {
    titleEn: `${params.decision === "REJECTED" ? "Rejected" : "Returned for revision"}: ${params.refLabel}`,
    titleVn: `${params.decision === "REJECTED" ? "Bị từ chối" : "Trả lại để chỉnh sửa"}: ${params.refLabel}`,
    bodyEn: params.comment || "",
    bodyVn: params.comment || "",
    link: params.link,
  });
  return { outcome: params.decision === "REJECTED" ? "rejected" : "returned" };
}

/** The queue for "Waiting for me": ACTIVE pending steps assigned to a user. */
export async function pendingStepsFor(userId: string, entityType?: ApprovalEntityType) {
  const steps = await db.approvalStep.findMany({
    where: { approverId: userId, status: "PENDING", ...(entityType ? { entityType } : {}) },
    orderBy: [{ slaDueAt: "asc" }, { createdAt: "asc" }],
  });
  // only the LOWEST pending level per entity is actionable (sequential execution)
  const actionable: typeof steps = [];
  for (const s of steps) {
    const lower = await db.approvalStep.count({
      where: { entityType: s.entityType, entityId: s.entityId, status: "PENDING", level: { lt: s.level } },
    });
    if (lower === 0) actionable.push(s);
  }
  return actionable;
}
