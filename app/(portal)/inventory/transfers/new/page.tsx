import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { TransferForm, type TrfOpt, type TrfItemOpt, type TrfStockRow } from "@/components/inv/TransferForm";

/** §10b: new stock transfer. */
export default async function NewTransferPage() {
  await requireRoles("WAREHOUSE", "ADMIN");

  const [warehouses, items, balances] = await Promise.all([
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    db.item.findMany({ where: { isActive: true }, include: { uom: { select: { code: true } } }, orderBy: { code: "asc" } }),
    db.stockBalance.findMany({ select: { warehouseId: true, itemId: true, qtyOnHand: true } }),
  ]);

  return (
    <TransferForm
      warehouses={warehouses.map((w): TrfOpt => ({ id: w.id, label: `${w.code} · ${w.nameEn}` }))}
      items={items.map((i): TrfItemOpt => ({ id: i.id, label: `${i.code} · ${i.nameEn}`, uom: i.uom.code }))}
      stock={balances.map((b): TrfStockRow => ({ warehouseId: b.warehouseId, itemId: b.itemId, onHand: decToString(b.qtyOnHand, 4) ?? "0" }))}
    />
  );
}
