"use server";

import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { ymdVn, ymdHmVn } from "@/lib/dates";
import { resolveScan } from "@/lib/barcode";

export type ScanResult =
  | { kind: "none" }
  | { kind: "notFound"; code: string }
  | { kind: "document"; href: string; label: string }
  | {
      kind: "lot";
      lotId: string;
      label: string;
      item: string;
      expiryDate: string | null;
      grn: string | null;
      po: string | null;
      vendor: string | null;
      balances: { warehouse: string; onHand: string }[];
      movements: { number: string; type: string; qty: string; when: string; ref: string }[];
    }
  | {
      kind: "item";
      itemId: string;
      label: string;
      isLotTracked: boolean;
      balances: { warehouse: string; warehouseId: string; onHand: string; avgCost: string }[];
      lots: { lotId: string; lotNumber: string; expiryDate: string | null; onHand: string }[];
    };

/** §21 scan hub resolver — documents open, lots/items return a stock + history panel. */
export async function scanLookup(raw: string): Promise<ScanResult> {
  await requireUser();
  const hit = await resolveScan(raw);

  if (hit.kind === "lot") {
    const lot = await db.lot.findUniqueOrThrow({
      where: { id: hit.lotId },
      include: {
        grn: { select: { grnNumber: true, po: { select: { poNumber: true } } } },
        vendor: { select: { code: true, nameEn: true } },
        stockBalances: { include: { warehouse: { select: { code: true } } } },
        movements: { orderBy: { postedAt: "desc" }, take: 10, select: { movementNumber: true, type: true, qty: true, postedAt: true, note: true } },
      },
    });
    return {
      kind: "lot",
      lotId: lot.id,
      label: lot.lotNumber,
      item: hit.item,
      expiryDate: lot.expiryDate ? ymdVn(lot.expiryDate) : null,
      grn: lot.grn?.grnNumber ?? null,
      po: lot.grn?.po.poNumber ?? null,
      vendor: lot.vendor ? `${lot.vendor.code} · ${lot.vendor.nameEn}` : null,
      balances: lot.stockBalances
        .filter((b) => Number(b.qtyOnHand) !== 0)
        .map((b) => ({ warehouse: b.warehouse.code, onHand: decToString(b.qtyOnHand, 4) ?? "0" })),
      movements: lot.movements.map((m) => ({
        number: m.movementNumber,
        type: m.type,
        qty: decToString(m.qty, 4) ?? "0",
        when: ymdHmVn(m.postedAt),
        ref: m.note ?? "—",
      })),
    };
  }

  if (hit.kind === "item") {
    const item = await db.item.findUniqueOrThrow({
      where: { id: hit.itemId },
      include: {
        stockBalances: { include: { warehouse: { select: { id: true, code: true } }, lot: { select: { id: true, lotNumber: true, expiryDate: true } } } },
      },
    });
    return {
      kind: "item",
      itemId: item.id,
      label: hit.label,
      isLotTracked: item.isLotTracked,
      balances: item.stockBalances
        .filter((b) => !b.lotId && Number(b.qtyOnHand) !== 0)
        .map((b) => ({
          warehouse: b.warehouse.code,
          warehouseId: b.warehouse.id,
          onHand: decToString(b.qtyOnHand, 4) ?? "0",
          avgCost: decToString(b.avgCostVnd, 2) ?? "0",
        })),
      lots: item.stockBalances
        .filter((b) => b.lotId && Number(b.qtyOnHand) !== 0)
        .map((b) => ({
          lotId: b.lot!.id,
          lotNumber: b.lot!.lotNumber,
          expiryDate: b.lot!.expiryDate ? ymdVn(b.lot!.expiryDate) : null,
          onHand: decToString(b.qtyOnHand, 4) ?? "0",
        })),
    };
  }

  return hit;
}
