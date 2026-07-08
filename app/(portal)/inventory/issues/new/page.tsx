import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { GiForm, type GiOpt, type GiItemOpt, type GiStockRow } from "@/components/gi/GiForm";

/** §10b: new goods-issue request. */
export default async function NewGoodsIssuePage() {
  await requireUser();

  const [warehouses, costCenters, items, balances] = await Promise.all([
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    db.costCenter.findMany({ orderBy: { code: "asc" } }),
    db.item.findMany({ where: { isActive: true }, include: { uom: { select: { code: true } } }, orderBy: { code: "asc" } }),
    db.stockBalance.findMany({ select: { warehouseId: true, itemId: true, qtyOnHand: true } }),
  ]);

  return (
    <GiForm
      warehouses={warehouses.map((w): GiOpt => ({ id: w.id, label: `${w.code} · ${w.nameEn}` }))}
      costCenters={costCenters.map((c): GiOpt => ({ id: c.id, label: `${c.code} · ${c.nameEn}` }))}
      items={items.map((i): GiItemOpt => ({ id: i.id, label: `${i.code} · ${i.nameEn}`, uom: i.uom.code }))}
      stock={balances.map((b): GiStockRow => ({ warehouseId: b.warehouseId, itemId: b.itemId, onHand: decToString(b.qtyOnHand, 4) ?? "0" }))}
    />
  );
}
