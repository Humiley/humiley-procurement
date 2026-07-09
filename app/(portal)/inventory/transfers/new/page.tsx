import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { TransferForm, type TrfOpt, type TrfItemOpt, type TrfStockRow } from "@/components/inv/TransferForm";

/** §10b: new stock transfer. */
export default async function NewTransferPage() {
  await requireRoles("WAREHOUSE", "ADMIN");
  const tc = await getTranslations("common");

  const [warehouses, items, balances] = await Promise.all([
    db.warehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    db.item.findMany({ where: { isActive: true }, include: { uom: { select: { code: true } } }, orderBy: { code: "asc" } }),
    db.stockBalance.findMany({ select: { warehouseId: true, itemId: true, qtyOnHand: true } }),
  ]);

  return (
    <div className="space-y-4">
      <Link href="/inventory/transfers" className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <TransferForm
        warehouses={warehouses.map((w): TrfOpt => ({ id: w.id, label: `${w.code} · ${w.nameEn}` }))}
        items={items.map((i): TrfItemOpt => ({ id: i.id, label: `${i.code} · ${i.nameEn}`, uom: i.uom.code }))}
        stock={balances.map((b): TrfStockRow => ({ warehouseId: b.warehouseId, itemId: b.itemId, onHand: decToString(b.qtyOnHand, 4) ?? "0" }))}
      />
    </div>
  );
}
