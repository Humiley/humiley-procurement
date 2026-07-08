import "server-only";
import { Prisma } from "@prisma/client";
import type { MovementType } from "@prisma/client";
import { db } from "@/lib/db";
import { nextDocNumber } from "@/lib/docnum";

/**
 * §10b / §22.4 — THE single stock writer. Every stock change posts a StockMovement AND updates
 * the StockBalance (+ moving-average cost) in ONE transaction with the balance row locked.
 * No other code may touch StockBalance.
 *
 *  IN  (GRN_IN / TRANSFER_IN / ADJUST_IN / RETURN_IN): avgCost = (onHand·avg + qty·unitCost) / newQty
 *  OUT (ISSUE_OUT / TRANSFER_OUT / ADJUST_OUT): guarded qty ≤ onHand; posts at CURRENT avgCost.
 */

const D = Prisma.Decimal;
const IN_TYPES: MovementType[] = ["GRN_IN", "TRANSFER_IN", "ADJUST_IN", "RETURN_IN"];

export class StockError extends Error {}

export type PostMovementInput = {
  type: MovementType;
  warehouseId: string;
  itemId: string;
  lotId?: string | null;
  qty: Prisma.Decimal.Value;          // positive
  unitCostVnd?: Prisma.Decimal.Value; // required for IN; ignored for OUT (avgCost used)
  refEntityType?: string | null;
  refEntityId?: string | null;
  note?: string | null;
  createdById: string;
};

export async function postMovement(input: PostMovementInput, outerTx?: Prisma.TransactionClient) {
  const qty = new D(input.qty);
  if (qty.lessThanOrEqualTo(0)) throw new StockError("Movement quantity must be positive.");
  const isIn = IN_TYPES.includes(input.type);

  const run = async (tx: Prisma.TransactionClient) => {
    // ensure + LOCK the balance row. NULL lotId needs the partial unique index
    // (StockBalance_wh_item_nolot_key) for a race-safe upsert — 3-column ON CONFLICT
    // never fires for NULLs in Postgres.
    const newId = `sb_${Math.random().toString(36).slice(2, 12)}${Date.now().toString(36)}`;
    if (input.lotId) {
      await tx.$executeRaw`
        INSERT INTO "StockBalance" ("id", "warehouseId", "itemId", "lotId", "qtyOnHand", "avgCostVnd")
        VALUES (${newId}, ${input.warehouseId}, ${input.itemId}, ${input.lotId}, 0, 0)
        ON CONFLICT ("warehouseId", "itemId", "lotId") DO NOTHING`;
    } else {
      await tx.$executeRaw`
        INSERT INTO "StockBalance" ("id", "warehouseId", "itemId", "lotId", "qtyOnHand", "avgCostVnd")
        VALUES (${newId}, ${input.warehouseId}, ${input.itemId}, NULL, 0, 0)
        ON CONFLICT ("warehouseId", "itemId") WHERE "lotId" IS NULL DO NOTHING`;
    }
    const rows = await tx.$queryRaw<Array<{ id: string; qtyOnHand: Prisma.Decimal; avgCostVnd: Prisma.Decimal }>>`
      SELECT "id", "qtyOnHand", "avgCostVnd" FROM "StockBalance"
      WHERE "warehouseId" = ${input.warehouseId} AND "itemId" = ${input.itemId}
        AND "lotId" IS NOT DISTINCT FROM ${input.lotId ?? null}
      FOR UPDATE`;
    const bal = rows[0];
    if (!bal) throw new StockError("Could not lock the stock balance row.");
    const onHand = new D(bal.qtyOnHand);
    const avg = new D(bal.avgCostVnd);

    let newQty: Prisma.Decimal;
    let newAvg: Prisma.Decimal;
    let unitCost: Prisma.Decimal;
    if (isIn) {
      unitCost = new D(input.unitCostVnd ?? 0);
      newQty = onHand.plus(qty);
      newAvg = newQty.isZero() ? new D(0) : onHand.times(avg).plus(qty.times(unitCost)).div(newQty).toDecimalPlaces(2);
    } else {
      if (qty.greaterThan(onHand)) {
        throw new StockError(`Insufficient stock: ${onHand.toString()} on hand, ${qty.toString()} requested.`);
      }
      unitCost = avg;               // OUT posts at current moving-average cost
      newQty = onHand.minus(qty);
      newAvg = avg;                 // average unchanged on OUT
    }

    await tx.stockBalance.update({ where: { id: bal.id }, data: { qtyOnHand: newQty, avgCostVnd: newAvg } });
    const movementNumber = await nextDocNumber("MOV", tx, { prefix: "MOV", pad: 6 });
    const mv = await tx.stockMovement.create({
      data: {
        movementNumber,
        type: input.type,
        warehouseId: input.warehouseId,
        itemId: input.itemId,
        lotId: input.lotId ?? null,
        qty,
        unitCostVnd: unitCost,
        refEntityType: input.refEntityType ?? null,
        refEntityId: input.refEntityId ?? null,
        note: input.note ?? null,
        createdById: input.createdById,
      },
    });
    return { movement: mv, qtyOnHand: newQty, avgCostVnd: newAvg };
  };

  return outerTx ? run(outerTx) : db.$transaction(run);
}
