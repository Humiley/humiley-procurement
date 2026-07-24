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
import { assertWarehouseKeeper } from "@/lib/stock/keeper";
import { guard } from "@/lib/safe-action";

const D = Prisma.Decimal;

/** §10b stock count (Kiểm kê): snapshot systemQty → enter counted → DIRECTOR posts signed adjustments. */
async function _createCount(input: CountCreatePayload) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = countCreateSchema.parse(input);

  await assertWarehouseKeeper(user, values.warehouseId);
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

async function _saveCounts(input: CountEnterPayload) {
  const user = await requireRoles("WAREHOUSE", "ADMIN");
  const values = countEnterSchema.parse(input);
  const count = await db.stockCount.findUnique({ where: { id: values.countId }, include: { lines: true } });
  if (!count) throw new Error("Stock count not found.");
  if (count.status !== "COUNTING") throw new Error("Only an open count can be edited.");
  await assertWarehouseKeeper(user, count.warehouseId);
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
async function _postCount(params: { id: string; password: string; reason?: string; imageData?: string | null }) {
  const user = await requireRoles("DIRECTOR", "ADMIN");
  const count = await db.stockCount.findUnique({
    where: { id: params.id },
    include: { lines: { include: { item: { select: { code: true } } } } },
  });
  if (!count) throw new Error("Stock count not found.");
  if (count.status !== "COUNTING") throw new Error("Only an open count can be posted.");

  // Claim-before-sign (mirrors GRN accept): flip COUNTING -> POSTED BEFORE signing so a rolled-back
  // adjustment (StockError, or a concurrent post winning the flip) can't strand an orphan COUNTED
  // signature on a count still COUNTING. Release back to COUNTING if signing or posting fails.
  const claim = await db.stockCount.updateMany({ where: { id: count.id, status: "COUNTING" }, data: { status: "POSTED" } });
  if (!claim.count) throw staleError();
  const releaseClaim = () =>
    db.stockCount.updateMany({ where: { id: count.id, status: "POSTED" }, data: { status: "COUNTING" } }).catch(() => {});

  let sig;
  try {
    sig = await signRecord({
      userId: user.id,
      password: params.password,
      entityType: "StockCount",
      entityId: count.id,
      meaning: "COUNTED",
      reason: params.reason,
      imageData: params.imageData ?? null,
      record: { countNumber: count.countNumber, lines: count.lines.map((l) => ({ i: l.itemId, sys: l.systemQty, cnt: l.countedQty })) },
    });
  } catch (e) {
    await releaseClaim();
    if (e instanceof SignatureError) throw new Error(e.message);
    throw e;
  }

  // The counted quantity is the physical TRUTH: the adjustment must bring the CURRENT balance
  // to countedQty, not replay a variance computed against the snapshot taken at count creation
  // (stock that moved between snapshot and posting would otherwise be silently re-added/removed).
  let adjustments = 0;
  try {
    await db.$transaction(async (tx) => {
      for (const l of count.lines) {
        // Read the balance under a row lock (FOR UPDATE) inside this same transaction, mirroring
        // post-movement.ts. postMovement re-reads the same row under the (re-entrant) lock, so
        // `current` here equals the on-hand it will apply the delta to — the adjustment resolves
        // to exactly countedQty even if another movement is contending for the row.
        const balRows = await tx.$queryRaw<Array<{ qtyOnHand: Prisma.Decimal; avgCostVnd: Prisma.Decimal }>>`
          SELECT "qtyOnHand", "avgCostVnd" FROM "StockBalance"
          WHERE "warehouseId" = ${count.warehouseId} AND "itemId" = ${l.itemId}
            AND "lotId" IS NOT DISTINCT FROM ${l.lotId ?? null}
          FOR UPDATE`;
        const bal = balRows[0];
        const current = new D(bal?.qtyOnHand ?? 0);
        const delta = new D(l.countedQty).minus(current);
        if (delta.isZero()) continue;
        adjustments += 1;
        await postMovement(
          {
            type: delta.greaterThan(0) ? "ADJUST_IN" : "ADJUST_OUT",
            warehouseId: count.warehouseId,
            itemId: l.itemId,
            lotId: l.lotId,
            qty: delta.abs(),
            // gains enter at the line's current average cost so stock value stays consistent
            unitCostVnd: delta.greaterThan(0) ? bal?.avgCostVnd ?? 0 : undefined,
            refEntityType: "StockCount",
            refEntityId: count.id,
            note: count.countNumber,
            createdById: user.id,
          },
          tx,
        );
      }
      // status already claimed above (COUNTING -> POSTED); no in-transaction flip needed.
    });
  } catch (e) {
    await releaseClaim();
    if (e instanceof StockError) throw new Error(e.message);
    throw e;
  }

  await audit({ userId: user.id, action: "CNT_POST", entityType: "StockCount", entityId: count.id, after: { adjustments, signatureId: sig.id } });
  revalidatePath(`/inventory/counts/${count.id}`);
  revalidatePath("/inventory/counts");
  revalidatePath("/inventory");
  return { id: count.id, adjustments };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function createCount(...a: Parameters<typeof _createCount>) { return guard(_createCount, a); }
export async function saveCounts(...a: Parameters<typeof _saveCounts>) { return guard(_saveCounts, a); }
export async function postCount(...a: Parameters<typeof _postCount>) { return guard(_postCount, a); }
