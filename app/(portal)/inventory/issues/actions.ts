"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser, requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { transition, staleError } from "@/lib/workflow/transition";
import { createSteps, applyDecision, type Decision } from "@/lib/workflow/engine";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { postMovement, StockError } from "@/lib/stock/post-movement";
import { checkReorderAfterOut } from "@/lib/stock/reorder";
import { giCreateSchema, giExecuteSchema, type GiCreatePayload, type GiExecutePayload } from "@/lib/schemas/gi";
import type { SignatureMeaning } from "@prisma/client";

const D = Prisma.Decimal;

/** §10b goods issue (Xuất kho): request → dept-manager approval → warehouse issues from stock. */
export async function createGoodsIssue(input: GiCreatePayload) {
  const user = await requireUser();
  const values = giCreateSchema.parse(input);
  if (!user.departmentId) throw new Error("Your account has no department — ask an admin to fix it.");

  const items = await db.item.findMany({ where: { id: { in: values.lines.map((l) => l.itemId) } }, select: { id: true, uomId: true } });
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const l of values.lines) if (!itemById.has(l.itemId)) throw new Error("Unknown item on a line.");

  const gi = await db.$transaction(async (tx) => {
    const issueNumber = await nextDocNumber("GI", tx, { prefix: "GI" });
    return tx.goodsIssue.create({
      data: {
        issueNumber,
        warehouseId: values.warehouseId,
        requesterId: user.id,
        departmentId: user.departmentId!,
        costCenterId: values.costCenterId,
        projectCode: values.projectCode || null,
        purpose: values.purpose,
        status: "DRAFT",
        lines: {
          create: values.lines.map((l) => ({
            itemId: l.itemId,
            qtyRequested: new D(l.qty),
            uomId: itemById.get(l.itemId)!.uomId,
          })),
        },
      },
    });
  });

  await audit({ userId: user.id, action: "GI_CREATE", entityType: "GoodsIssue", entityId: gi.id, after: { issueNumber: gi.issueNumber, lines: values.lines.length } });
  revalidatePath("/inventory/issues");
  return { id: gi.id };
}

export async function submitGoodsIssue(id: string) {
  const user = await requireUser();
  const gi = await db.goodsIssue.findUnique({ where: { id } });
  if (!gi) throw new Error("Goods issue not found.");
  if (gi.requesterId !== user.id) throw new Error("Only the requester can submit.");
  if (gi.status !== "DRAFT") throw new Error("Only a draft can be submitted.");

  if (!(await transition(db.goodsIssue, id, "DRAFT", "SUBMITTED"))) throw staleError();
  try {
    await createSteps({
      entityType: "GOODS_ISSUE",
      entityId: id,
      amountVnd: 0,
      departmentId: gi.departmentId,
      requesterId: gi.requesterId,
      link: `/inventory/issues/${id}`,
      refLabel: gi.issueNumber,
    });
  } catch (e) {
    await transition(db.goodsIssue, id, "SUBMITTED", "DRAFT");
    throw e;
  }
  await audit({ userId: user.id, action: "GI_SUBMIT", entityType: "GoodsIssue", entityId: id, after: { status: "SUBMITTED" } });
  revalidatePath(`/inventory/issues/${id}`);
  revalidatePath("/inventory/issues");
  return { id };
}

export async function decideGoodsIssue(params: { id: string; decision: Decision; password: string; comment?: string }) {
  const user = await requireUser();
  const gi = await db.goodsIssue.findUnique({ where: { id: params.id }, include: { lines: true } });
  if (!gi) throw new Error("Goods issue not found.");
  if (gi.status !== "SUBMITTED") throw new Error("Only a submitted goods issue can be decided.");

  const meaning: SignatureMeaning =
    params.decision === "APPROVED" ? "APPROVED" : params.decision === "REJECTED" ? "REJECTED" : "REVIEWED";
  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "GoodsIssue",
      entityId: gi.id,
      meaning,
      reason: params.comment,
      record: { issueNumber: gi.issueNumber, purpose: gi.purpose, lines: gi.lines.map((l) => ({ i: l.itemId, q: l.qtyRequested })) },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  const result = await applyDecision({
    entityType: "GOODS_ISSUE",
    entityId: gi.id,
    approverId: user.id,
    decision: params.decision,
    comment: params.comment,
    snapshotHash: sig.recordSnapshotHash,
    link: `/inventory/issues/${gi.id}`,
    refLabel: gi.issueNumber,
    requesterId: gi.requesterId,
  });

  if (result.outcome === "approved") {
    if (!(await transition(db.goodsIssue, gi.id, "SUBMITTED", "APPROVED"))) throw staleError();
  } else if (result.outcome === "rejected") {
    if (!(await transition(db.goodsIssue, gi.id, "SUBMITTED", "REJECTED"))) throw staleError();
  } else if (result.outcome === "returned") {
    if (!(await transition(db.goodsIssue, gi.id, "SUBMITTED", "DRAFT"))) throw staleError();
  }

  await audit({ userId: user.id, action: `GI_${params.decision}`, entityType: "GoodsIssue", entityId: gi.id, after: { decision: params.decision, signatureId: sig.id } });
  revalidatePath("/approvals");
  revalidatePath(`/inventory/issues/${gi.id}`);
  revalidatePath("/inventory/issues");
  return { outcome: result.outcome };
}

/** WAREHOUSE executes: ISSUED signature; qtyIssued ≤ onHand enforced by the stock writer; OUT at avgCost. */
export async function executeGoodsIssue(params: { payload: GiExecutePayload; password: string }) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = giExecuteSchema.parse(params.payload);

  const gi = await db.goodsIssue.findUnique({
    where: { id: values.issueId },
    include: { lines: { include: { item: { select: { isLotTracked: true } } } } },
  });
  if (!gi) throw new Error("Goods issue not found.");
  if (gi.status !== "APPROVED") throw new Error("Only an approved goods issue can be executed.");
  const lineById = new Map(gi.lines.map((l) => [l.id, l]));
  const issuing = values.lines.filter((l) => Number(l.qtyIssued) > 0);
  if (!issuing.length) throw new Error("Issue at least one unit.");
  for (const l of issuing) {
    const gl = lineById.get(l.lineId);
    if (!gl) throw new Error("Line does not belong to this goods issue.");
    if (new D(l.qtyIssued).greaterThan(gl.qtyRequested)) throw new Error("Cannot issue more than requested.");
  }
  // pre-check stock BEFORE signing so a refused issue leaves no orphan ISSUED signature
  // (the FOR-UPDATE guard inside postMovement stays the authoritative race-safe check).
  // §21 FEFO: lot-tracked items consume non-expired lots earliest-expiry-first; expired lots
  // are blocked from issue entirely.
  const today = new Date(new Date().toDateString());
  const balances = await db.stockBalance.findMany({
    where: { warehouseId: gi.warehouseId, itemId: { in: issuing.map((l) => lineById.get(l.lineId)!.itemId) }, qtyOnHand: { gt: 0 } },
    include: { lot: { select: { id: true, lotNumber: true, expiryDate: true } } },
  });
  const fefoPlan = new Map<string, { lotId: string | null; qty: Prisma.Decimal }[]>();
  for (const l of issuing) {
    const gl = lineById.get(l.lineId)!;
    let need = new D(l.qtyIssued);
    if (gl.item.isLotTracked) {
      const lots = balances
        .filter((b) => b.itemId === gl.itemId && b.lotId && !(b.lot?.expiryDate && b.lot.expiryDate < today))
        .sort((x, y) => {
          const ex = x.lot?.expiryDate?.getTime() ?? Infinity;
          const ey = y.lot?.expiryDate?.getTime() ?? Infinity;
          return ex - ey;
        });
      const plan: { lotId: string | null; qty: Prisma.Decimal }[] = [];
      for (const b of lots) {
        if (need.lessThanOrEqualTo(0)) break;
        const take = D.min(need, new D(b.qtyOnHand));
        plan.push({ lotId: b.lotId, qty: take });
        need = need.minus(take);
      }
      if (need.greaterThan(0)) {
        const avail = lots.reduce((s2, b) => s2.plus(b.qtyOnHand), new D(0));
        throw new Error(`Insufficient non-expired lot stock: ${avail.toString()} available, ${new D(l.qtyIssued).toString()} requested.`);
      }
      fefoPlan.set(l.lineId, plan);
    } else {
      const onHand = balances
        .filter((b) => b.itemId === gl.itemId && !b.lotId)
        .reduce((s2, b) => s2.plus(b.qtyOnHand), new D(0));
      if (need.greaterThan(onHand)) {
        throw new Error(`Insufficient stock: ${onHand.toString()} on hand, ${need.toString()} requested.`);
      }
      fefoPlan.set(l.lineId, [{ lotId: null, qty: need }]);
    }
  }

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "GoodsIssue",
      entityId: gi.id,
      meaning: "ISSUED",
      record: { issueNumber: gi.issueNumber, lines: issuing.map((l) => ({ id: l.lineId, q: l.qtyIssued })) },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  try {
    await db.$transaction(async (tx) => {
      for (const l of issuing) {
        const gl = lineById.get(l.lineId)!;
        for (const part of fefoPlan.get(l.lineId)!) {
          await postMovement(
            {
              type: "ISSUE_OUT",
              warehouseId: gi.warehouseId,
              itemId: gl.itemId,
              lotId: part.lotId,
              qty: part.qty,
              refEntityType: "GoodsIssue",
              refEntityId: gi.id,
              note: gi.issueNumber,
              createdById: user.id,
            },
            tx,
          );
        }
        const single = fefoPlan.get(l.lineId)!.length === 1 ? fefoPlan.get(l.lineId)![0].lotId : null;
        await tx.goodsIssueLine.update({ where: { id: l.lineId }, data: { qtyIssued: new D(l.qtyIssued), lotId: single } });
      }
      await tx.goodsIssue.update({ where: { id: gi.id }, data: { status: "ISSUED", issuedById: user.id, issuedAt: new Date() } });
    });
  } catch (e) {
    if (e instanceof StockError) throw new Error(e.message);
    throw e;
  }

  await checkReorderAfterOut(gi.warehouseId, issuing.map((l) => lineById.get(l.lineId)!.itemId));

  // §10b: the issued cost charges the cost center's budget under "from stock"
  try {
    const { spendFromStock } = await import("@/lib/budget");
    await spendFromStock(gi.id);
  } catch (e) {
    console.warn("from-stock budget spend failed:", e);
  }

  await audit({ userId: user.id, action: "GI_EXECUTE", entityType: "GoodsIssue", entityId: gi.id, after: { lines: issuing.length, signatureId: sig.id } });
  revalidatePath(`/inventory/issues/${gi.id}`);
  revalidatePath("/inventory/issues");
  revalidatePath("/inventory");
  return { id: gi.id };
}
