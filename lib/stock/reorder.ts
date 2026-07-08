import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { notifyRole } from "@/lib/notify";

const D = Prisma.Decimal;
const OPEN_PO_STATUSES = ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] as const;

export type ReorderBreach = {
  policyId: string;
  warehouseId: string;
  warehouseCode: string;
  itemId: string;
  itemLabel: string;
  uom: string;
  onHand: string;
  openPoQty: string;
  minQty: string;
  reorderQty: string;
};

/** §10b: qtyOnHand + qty on open POs < minQty ⇒ breach. Runs across all policies (or a filter). */
export async function findReorderBreaches(filter?: { warehouseId?: string; itemIds?: string[] }): Promise<ReorderBreach[]> {
  const policies = await db.itemStockPolicy.findMany({
    where: {
      minQty: { gt: 0 },
      ...(filter?.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter?.itemIds?.length ? { itemId: { in: filter.itemIds } } : {}),
    },
    include: {
      item: { select: { code: true, nameEn: true, uom: { select: { code: true } } } },
      warehouse: { select: { code: true } },
    },
  });
  if (!policies.length) return [];

  const itemIds = policies.map((p) => p.itemId);
  const [balances, openLines] = await Promise.all([
    db.stockBalance.findMany({ where: { itemId: { in: itemIds } } }),
    db.poLine.findMany({
      where: { itemId: { in: itemIds }, po: { status: { in: [...OPEN_PO_STATUSES] } } },
      select: { itemId: true, qty: true, receivedQty: true },
    }),
  ]);

  const breaches: ReorderBreach[] = [];
  for (const p of policies) {
    const onHand = balances
      .filter((b) => b.itemId === p.itemId && b.warehouseId === p.warehouseId)
      .reduce((s, b) => s.plus(b.qtyOnHand), new D(0));
    // open-PO quantity counts company-wide (POs don't carry a destination warehouse)
    const openPo = openLines
      .filter((l) => l.itemId === p.itemId)
      .reduce((s, l) => s.plus(new D(l.qty).minus(l.receivedQty)), new D(0));
    if (onHand.plus(openPo).lessThan(p.minQty)) {
      breaches.push({
        policyId: p.id,
        warehouseId: p.warehouseId,
        warehouseCode: p.warehouse.code,
        itemId: p.itemId,
        itemLabel: `${p.item.code} · ${p.item.nameEn}`,
        uom: p.item.uom.code,
        onHand: onHand.toString(),
        openPoQty: openPo.toString(),
        minQty: new D(p.minQty).toString(),
        reorderQty: new D(p.reorderQty).toString(),
      });
    }
  }
  return breaches;
}

/**
 * After any OUT movement: notify PURCHASER once per breach (deduped on an unread notification
 * with the same link). Best-effort — never blocks the stock transaction that triggered it.
 */
export async function checkReorderAfterOut(warehouseId: string, itemIds: string[]) {
  try {
    const breaches = await findReorderBreaches({ warehouseId, itemIds });
    for (const b of breaches) {
      const link = `/inventory/reorder?wh=${b.warehouseId}&item=${b.itemId}`;
      const dup = await db.notification.findFirst({ where: { link, isRead: false } });
      if (dup) continue;
      const { fireWebhook } = await import("@/lib/webhooks");
      await fireWebhook("stock.belowMin", { warehouse: b.warehouseCode, item: b.itemLabel, onHand: b.onHand, minQty: b.minQty, reorderQty: b.reorderQty });
      await notifyRole("PURCHASER", {
        titleEn: `Reorder: ${b.itemLabel} below minimum at ${b.warehouseCode}`,
        titleVn: `Đặt hàng lại: ${b.itemLabel} dưới tồn tối thiểu tại ${b.warehouseCode}`,
        bodyEn: `On hand ${b.onHand} + open PO ${b.openPoQty} < min ${b.minQty}. Suggested reorder: ${b.reorderQty} ${b.uom}.`,
        bodyVn: `Tồn ${b.onHand} + PO đang mở ${b.openPoQty} < tối thiểu ${b.minQty}. Đề xuất đặt lại: ${b.reorderQty} ${b.uom}.`,
        link,
      });
    }
  } catch (e) {
    console.warn("reorder check failed:", e);
  }
}
