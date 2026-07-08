"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { nextDocNumber } from "@/lib/docnum";
import { staleError } from "@/lib/workflow/transition";
import { signRecord, SignatureError } from "@/lib/esign/sign";
import { postMovement, StockError } from "@/lib/stock/post-movement";
import { countCreateSchema, countEnterSchema, type CountCreatePayload, type CountEnterPayload } from "@/lib/schemas/transfer";

const D = Prisma.Decimal;

/** §10b stock count (Kiểm kê): snapshot systemQty → enter counted → DIRECTOR posts signed adjustments. */
export async function createCount(input: CountCreatePayload) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = countCreateSchema.parse(input);

  const balances = await db.stockBalance.findMany({ where: { warehouseId: values.warehouseId } });
  if (!balances.length) throw new Error("This warehouse has no stock lines to count.");

  const count = await db.$transaction(async (tx) => {
    const countNumber = await nextDocNumber("CNT", tx, { prefix: "CNT" });
    return tx.stockCount.create({
      data: {
        countNumber,
        warehouseId: values.warehouseId,
        notes: values.notes || null,
        status: "COUNTING",
        lines: {
          create: balances.map((b) => ({
            itemId: b.itemId,
            lotId: b.lotId,
            systemQty: b.qtyOnHand,
            countedQty: b.qtyOnHand,   // start at system; keeper edits what differs
            varianceQty: 0,
          })),
        },
      },
    });
  });

  await audit({ userId: user.id, action: "CNT_CREATE", entityType: "StockCount", entityId: count.id, after: { countNumber: count.countNumber, lines: balances.length } });
  revalidatePath("/inventory/counts");
  return { id: count.id };
}

export async function saveCounts(input: CountEnterPayload) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = countEnterSchema.parse(input);
  const count = await db.stockCount.findUnique({ where: { id: values.countId }, include: { lines: true } });
  if (!count) throw new Error("Stock count not found.");
  if (count.status !== "COUNTING") throw new Error("Only an open count can be edited.");
  const lineById = new Map(count.lines.map((l) => [l.id, l]));

  await db.$transaction(async (tx) => {
    for (const l of values.lines) {
      const cl = lineById.get(l.lineId);
      if (!cl) throw new Error("Line does not belong to this count.");
      const counted = new D(l.countedQty);
      await tx.stockCountLine.update({
        where: { id: l.lineId },
        data: { countedQty: counted, varianceQty: counted.minus(cl.systemQty) },
      });
    }
  });

  await audit({ userId: user.id, action: "CNT_SAVE", entityType: "StockCount", entityId: count.id, after: { lines: values.lines.length } });
  revalidatePath(`/inventory/counts/${count.id}`);
  return { id: count.id };
}

/** DIRECTOR posts the count: COUNTED signature; variances become ADJUST_IN/OUT at current avg cost. */
export async function postCount(params: { id: string; password: string; reason?: string }) {
  const user = await requireRoles("DIRECTOR", "ADMIN");
  const count = await db.stockCount.findUnique({
    where: { id: params.id },
    include: { lines: { include: { item: { select: { code: true } } } } },
  });
  if (!count) throw new Error("Stock count not found.");
  if (count.status !== "COUNTING") throw new Error("Only an open count can be posted.");

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "StockCount",
      entityId: count.id,
      meaning: "COUNTED",
      reason: params.reason,
      record: { countNumber: count.countNumber, lines: count.lines.map((l) => ({ i: l.itemId, sys: l.systemQty, cnt: l.countedQty })) },
    });
  } catch (e) {
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  const variances = count.lines.filter((l) => !new D(l.varianceQty).isZero());
  try {
    await db.$transaction(async (tx) => {
      for (const l of variances) {
        const v = new D(l.varianceQty);
        if (v.greaterThan(0)) {
          // gain adjusts IN at the line's current average cost so stock value stays consistent
          const bal = await tx.stockBalance.findFirst({ where: { warehouseId: count.warehouseId, itemId: l.itemId, lotId: l.lotId } });
          await postMovement(
            {
              type: "ADJUST_IN",
              warehouseId: count.warehouseId,
              itemId: l.itemId,
              lotId: l.lotId,
              qty: v,
              unitCostVnd: bal?.avgCostVnd ?? 0,
              refEntityType: "StockCount",
              refEntityId: count.id,
              note: count.countNumber,
              createdById: user.id,
            },
            tx,
          );
        } else {
          await postMovement(
            {
              type: "ADJUST_OUT",
              warehouseId: count.warehouseId,
              itemId: l.itemId,
              lotId: l.lotId,
              qty: v.negated(),
              refEntityType: "StockCount",
              refEntityId: count.id,
              note: count.countNumber,
              createdById: user.id,
            },
            tx,
          );
        }
      }
      const ok = await tx.stockCount.updateMany({ where: { id: count.id, status: "COUNTING" }, data: { status: "POSTED" } });
      if (!ok.count) throw staleError();
    });
  } catch (e) {
    if (e instanceof StockError) throw new Error(e.message);
    throw e;
  }

  await audit({ userId: user.id, action: "CNT_POST", entityType: "StockCount", entityId: count.id, after: { adjustments: variances.length, signatureId: sig.id } });
  revalidatePath(`/inventory/counts/${count.id}`);
  revalidatePath("/inventory/counts");
  revalidatePath("/inventory");
  return { id: count.id, adjustments: variances.length };
}
