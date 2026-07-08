import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { KpiCard } from "@/components/shared/KpiCard";

/** §10b stock balances — warehouse × item, on-hand, moving-average cost, value. */
export default async function InventoryPage() {
  await requireUser();
  const t = await getTranslations("inventory");

  const balances = await db.stockBalance.findMany({
    include: {
      warehouse: { select: { code: true } },
      item: { select: { code: true, nameEn: true, uom: { select: { code: true } } } },
    },
    orderBy: [{ warehouseId: "asc" }, { itemId: "asc" }],
  });

  const rows = balances
    .filter((b) => Number(b.qtyOnHand) !== 0)
    .map((b) => {
      const qty = Number(decToString(b.qtyOnHand, 4));
      const avg = Number(decToString(b.avgCostVnd, 2));
      return {
        id: b.id,
        warehouseId: b.warehouseId,
        itemId: b.itemId,
        wh: b.warehouse.code,
        item: `${b.item.code} · ${b.item.nameEn}`,
        uom: b.item.uom.code,
        qty,
        avg,
        value: qty * avg,
      };
    });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
        <Link href="/inventory/issues/new" className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
          {t("requestIssue")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <KpiCard label={t("kpiLines")} value={rows.length.toLocaleString("en-US")} />
        <KpiCard label={t("kpiValue")} value={`${Math.round(totalValue).toLocaleString("en-US")} ₫`} />
        <KpiCard label={t("kpiWarehouses")} value={new Set(rows.map((r) => r.wh)).size.toLocaleString("en-US")} />
      </div>

      {rows.length === 0 ? (
        <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2.5">{t("colWarehouse")}</th>
                <th className="px-3 py-2.5">{t("colItem")}</th>
                <th className="px-3 py-2.5 text-right">{t("colOnHand")}</th>
                <th className="px-3 py-2.5 text-right">{t("colAvgCost")}</th>
                <th className="px-3 py-2.5 text-right">{t("colValue")}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-grey/10 last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-semibold">{r.wh}</td>
                  <td className="px-3 py-2.5">{r.item}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.qty.toLocaleString("en-US")} {r.uom}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.avg.toLocaleString("en-US")} ₫</td>
                  <td className="px-3 py-2.5 text-right font-medium tabular-nums">{Math.round(r.value).toLocaleString("en-US")} ₫</td>
                  <td className="px-3 py-2.5 text-right">
                    <Link href={`/inventory/card?wh=${r.warehouseId}&item=${r.itemId}`} className="text-xs font-semibold text-navy hover:underline">
                      {t("stockCard")} →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
