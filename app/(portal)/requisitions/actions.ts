"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { createSteps } from "@/lib/workflow/engine";
import { prCreateSchema, type PrCreateInput, type PrFormPayload } from "@/lib/schemas/pr";
import { guard } from "@/lib/safe-action";

function lineTotals(lines: PrCreateInput["lines"]) {
  const total = lines.reduce(
    (s, l) => s.plus(new Prisma.Decimal(l.qty).times(l.estUnitPriceVnd)),
    new Prisma.Decimal(0),
  );
  return total.toDecimalPlaces(2);
}

function toLineData(lines: PrCreateInput["lines"]) {
  return lines.map((l) => ({
    itemId: l.itemId ?? null,
    freeTextDescription: l.itemId ? (l.freeTextDescription ?? null) : (l.freeTextDescription ?? null),
    uomId: l.uomId,
    qty: new Prisma.Decimal(l.qty),
    estUnitPriceVnd: new Prisma.Decimal(l.estUnitPriceVnd),
    isCapex: l.isCapex ?? false,
    note: l.note ?? null,
  }));
}

async function _createPr(input: PrFormPayload) {
  const user = await requireUser();
  if (!user.departmentId) {
    throw new Error("You must belong to a department to raise a requisition.");
  }
  const data = prCreateSchema.parse(input);
  const total = lineTotals(data.lines);

  const pr = await db.$transaction(async (tx) => {
    const prNumber = await nextDocNumber("PR", tx, { prefix: "PR" });
    return tx.purchaseRequisition.create({
      data: {
        prNumber,
        requesterId: user.id,
        departmentId: user.departmentId!,
        costCenterId: data.costCenterId,
        neededByDate: new Date(data.neededByDate),
        purpose: data.purpose,
        projectCode: data.projectCode ?? null,
        status: "DRAFT",
        totalEstimatedVnd: total,
        lines: { create: toLineData(data.lines) },
      },
    });
  });

  await audit({
    userId: user.id,
    action: "PR_CREATE",
    entityType: "PurchaseRequisition",
    entityId: pr.id,
    after: { prNumber: pr.prNumber, lines: data.lines.length, total: total.toFixed(2) },
  });
  revalidatePath("/requisitions");
  return { id: pr.id, prNumber: pr.prNumber };
}

async function _updatePr(id: string, input: PrFormPayload) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({ where: { id } });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.requesterId !== user.id) throw new Error("You can only edit your own requisition.");
  if (pr.status !== "DRAFT") throw new Error("Only a draft requisition can be edited.");

  const data = prCreateSchema.parse(input);
  const total = lineTotals(data.lines);

  await db.$transaction(async (tx) => {
    await tx.prLine.deleteMany({ where: { prId: id } });
    await tx.purchaseRequisition.update({
      where: { id },
      data: {
        costCenterId: data.costCenterId,
        neededByDate: new Date(data.neededByDate),
        purpose: data.purpose,
        projectCode: data.projectCode ?? null,
        totalEstimatedVnd: total,
        lines: { create: toLineData(data.lines) },
      },
    });
  });

  await audit({
    userId: user.id,
    action: "PR_UPDATE",
    entityType: "PurchaseRequisition",
    entityId: id,
    after: { lines: data.lines.length, total: total.toFixed(2) },
  });
  revalidatePath(`/requisitions/${id}`);
  revalidatePath("/requisitions");
  return { id };
}

async function _submitPr(id: string) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({
    where: { id },
    include: { _count: { select: { lines: true } } },
  });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.requesterId !== user.id) throw new Error("You can only submit your own requisition.");
  if (pr.status !== "DRAFT") throw new Error("Only a draft requisition can be submitted.");
  if (pr._count.lines === 0) throw new Error("Add at least one line before submitting.");

  // §9 budget gate: WARN lets the submit through (approvers see the red banner on the PR);
  // BLOCK refuses the submit outright per the requester department's policy.
  const { checkPrBudget } = await import("@/lib/budget/check");
  const overRows = (await checkPrBudget(id)).filter((r) => r.over);
  if (overRows.length) {
    const dept = await db.department.findUnique({ where: { id: pr.departmentId }, select: { overBudgetPolicy: true } });
    if (dept?.overBudgetPolicy === "BLOCK") {
      const detail = overRows.map((r) => `${r.costCenter}×${r.category} (remaining ${Number(r.remainingVnd).toLocaleString("en-US")} ₫, requested ${Number(r.newCommitVnd).toLocaleString("en-US")} ₫)`).join("; ");
      throw new Error(`Over budget — submission blocked by department policy: ${detail}`);
    }
  }

  if (!(await transition(db.purchaseRequisition, id, "DRAFT", "SUBMITTED"))) throw staleError();
  // §6: build the sequential approval chain from the matrix and hand it to level 1.
  try {
    const full = await db.purchaseRequisition.findUniqueOrThrow({ where: { id } });
    const steps = await createSteps({
      entityType: "PR",
      entityId: id,
      amountVnd: Number(full.totalEstimatedVnd),
      departmentId: full.departmentId,
      requesterId: full.requesterId,
      link: `/requisitions/${id}`,
      refLabel: full.prNumber,
    });
    await db.purchaseRequisition.update({
      where: { id },
      data: { currentApprovalLevel: steps[0]?.level ?? 1 },
    });
  } catch (e) {
    // No matrix band / no approver — roll the submit back so the PR is not stranded.
    await transition(db.purchaseRequisition, id, "SUBMITTED", "DRAFT");
    throw e;
  }
  await audit({
    userId: user.id,
    action: "PR_SUBMIT",
    entityType: "PurchaseRequisition",
    entityId: id,
    before: { status: "DRAFT" },
    after: { status: "SUBMITTED" },
  });
  revalidatePath(`/requisitions/${id}`);
  revalidatePath("/requisitions");
  return { id };
}

async function _recallPr(id: string) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({ where: { id } });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.requesterId !== user.id) throw new Error("You can only recall your own requisition.");
  // Recallable until an approver has ACTED: steps are created at submit (level 1 active), so the
  // guard is "no step decided yet", not the approval level.
  const decided = await db.approvalStep.count({
    where: { entityType: "PR", entityId: id, status: { not: "PENDING" } },
  });
  if (pr.status !== "SUBMITTED" || decided > 0) {
    throw new Error("This requisition can no longer be recalled — a review has already started.");
  }
  if (!(await transition(db.purchaseRequisition, id, "SUBMITTED", "DRAFT"))) throw staleError();
  // TOCTOU guard: an approver may have ACTED in the window between the count above and this transition
  // (recall reads decided=0, approve commits step=APPROVED while the PR is still SUBMITTED, recall then
  // flips it to DRAFT). Re-check after the transition: if a step is now decided, UNDO the recall (back
  // to SUBMITTED) and fail — an acted-upon requisition must not silently drop to DRAFT leaving an
  // orphaned approval behind.
  const decidedNow = await db.approvalStep.count({
    where: { entityType: "PR", entityId: id, status: { not: "PENDING" } },
  });
  if (decidedNow > 0) {
    await transition(db.purchaseRequisition, id, "DRAFT", "SUBMITTED");
    throw new Error("This requisition can no longer be recalled — a review has just started.");
  }
  // A racing approval loses: its step row was deleted, decideStep will find nothing pending.
  await db.approvalStep.deleteMany({ where: { entityType: "PR", entityId: id, status: "PENDING" } });
  await db.purchaseRequisition.update({ where: { id }, data: { currentApprovalLevel: 0 } });
  await audit({
    userId: user.id,
    action: "PR_RECALL",
    entityType: "PurchaseRequisition",
    entityId: id,
    after: { status: "DRAFT" },
  });
  revalidatePath(`/requisitions/${id}`);
  revalidatePath("/requisitions");
  return { id };
}

async function _cancelPr(id: string) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({ where: { id } });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.requesterId !== user.id) throw new Error("You can only cancel your own requisition.");
  if (pr.status !== "DRAFT" && pr.status !== "SUBMITTED") {
    throw new Error("Only a draft or submitted requisition can be cancelled.");
  }
  if (!(await transition(db.purchaseRequisition, id, ["DRAFT", "SUBMITTED"], "CANCELLED"))) throw staleError();
  // Clear any PENDING approval steps so a cancelled requisition stops surfacing in approvers' queues
  // (pendingStepsFor would otherwise keep returning it as actionable).
  await db.approvalStep.deleteMany({ where: { entityType: "PR", entityId: id, status: "PENDING" } });
  await audit({
    userId: user.id,
    action: "PR_CANCEL",
    entityType: "PurchaseRequisition",
    entityId: id,
    after: { status: "CANCELLED" },
  });
  revalidatePath(`/requisitions/${id}`);
  revalidatePath("/requisitions");
  return { id };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createPr(...a: Parameters<typeof _createPr>) { return guard(_createPr, a); }
export async function updatePr(...a: Parameters<typeof _updatePr>) { return guard(_updatePr, a); }
export async function submitPr(...a: Parameters<typeof _submitPr>) { return guard(_submitPr, a); }
export async function recallPr(...a: Parameters<typeof _recallPr>) { return guard(_recallPr, a); }
export async function cancelPr(...a: Parameters<typeof _cancelPr>) { return guard(_cancelPr, a); }
