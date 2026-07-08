import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { v1List } from "../lib";

export const GET = v1List(({ take, skip }) =>
  db.stockBalance
    .findMany({ take, skip, where: { qtyOnHand: { gt: 0 } }, orderBy: [{ warehouseId: "asc" }, { itemId: "asc" }], include: { warehouse: { select: { code: true } }, item: { select: { code: true, nameEn: true } }, lot: { select: { lotNumber: true, expiryDate: true } } } })
    .then((rows) =>
      rows.map((b) => ({
        warehouse: b.warehouse.code, itemCode: b.item.code, itemName: b.item.nameEn,
        lotNumber: b.lot?.lotNumber ?? null, expiryDate: b.lot?.expiryDate ?? null,
        qtyOnHand: decToString(b.qtyOnHand, 4), avgCostVnd: decToString(b.avgCostVnd, 2),
      })),
    ),
);
