"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { prCreateSchema, type PrCreateInput, type PrFormPayload } from "@/lib/schemas/pr";

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

export async function createPr(input: PrFormPayload) {
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

export async function updatePr(id: string, input: PrFormPayload) {
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

export async function submitPr(id: string) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({
    where: { id },
    include: { _count: { select: { lines: true } } },
  });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.requesterId !== user.id) throw new Error("You can only submit your own requisition.");
  if (pr.status !== "DRAFT") throw new Error("Only a draft requisition can be submitted.");
  if (pr._count.lines === 0) throw new Error("Add at least one line before submitting.");

  // Budget check (§9) and approval-step generation (§6) are wired in later phases.
  if (!(await transition(db.purchaseRequisition, id, "DRAFT", "SUBMITTED"))) throw staleError();
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

export async function recallPr(id: string) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({ where: { id } });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.requesterId !== user.id) throw new Error("You can only recall your own requisition.");
  if (pr.status !== "SUBMITTED" || pr.currentApprovalLevel > 0) {
    throw new Error("This requisition can no longer be recalled — a review has already started.");
  }
  // Optimistic guard also re-checks the approval level, so a racing approval blocks the recall.
  if (!(await transition(db.purchaseRequisition, id, "SUBMITTED", "DRAFT", { where: { currentApprovalLevel: 0 } }))) throw staleError();
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

export async function cancelPr(id: string) {
  const user = await requireUser();
  const pr = await db.purchaseRequisition.findUnique({ where: { id } });
  if (!pr) throw new Error("Requisition not found.");
  if (pr.requesterId !== user.id) throw new Error("You can only cancel your own requisition.");
  if (pr.status !== "DRAFT" && pr.status !== "SUBMITTED") {
    throw new Error("Only a draft or submitted requisition can be cancelled.");
  }
  if (!(await transition(db.purchaseRequisition, id, ["DRAFT", "SUBMITTED"], "CANCELLED"))) throw staleError();
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
