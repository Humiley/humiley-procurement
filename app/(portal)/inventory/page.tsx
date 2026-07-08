import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { KpiCard } from "@/components/shared/KpiCard";
import { findReorderBreaches } from "@/lib/stock/reorder";

/** §10b stock overview — balances + dashboard (value, below-min, in-transit, slow movers). */
export default async function InventoryPage() {
  await requireUser();
  const t = await getTranslations("inventory");

  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 3600 * 1000);
  const [balances, breaches, inTransit, recentMoves] = await Promise.all([
    db.stockBalance.findMany({
      include: {
        warehouse: { select: { code: true } },
        item: { select: { code: true, nameEn: true, uom: { select: { code: true } } } },
      },
      orderBy: [{ warehouseId: "asc" }, { itemId: "asc" }],
    }),
    findReorderBreaches(),
    db.stockTransfer.count({ where: { status: "IN_TRANSIT" } }),
    db.stockMovement.findMany({
      where: { postedAt: { gte: ninetyDaysAgo } },
      select: { warehouseId: true, itemId: true },
      distinct: ["warehouseId", "itemId"],
    }),
  ]);
  const movedRecently = new Set(recentMoves.map((m) => `${m.warehouseId}|${m.itemId}`));

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
  const slowMovers = rows.filter((r) => !movedRecently.has(`${r.warehouseId}|${r.itemId}`));
  const valueByWh = Array.from(
    rows.reduce((m, r) => m.set(r.wh, (m.get(r.wh) ?? 0) + r.value), new Map<string, number>()).entries(),
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
        <Link href="/inventory/issues/new" className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
          {t("requestIssue")}
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label={t("kpiLines")} value={rows.length.toLocaleString("en-US")} />
        <KpiCard label={t("kpiValue")} value={`${Math.round(totalValue).toLocaleString("en-US")} ₫`} />
        <KpiCard label={t("kpiWarehouses")} value={new Set(rows.map((r) => r.wh)).size.toLocaleString("en-US")} />
        <KpiCard label={t("kpiBelowMin")} value={breaches.length.toLocaleString("en-US")} href="/inventory/reorder" accent="emerald" />
        <KpiCard label={t("kpiInTransit")} value={inTransit.toLocaleString("en-US")} href="/inventory/transfers" />
      </div>

      {breaches.length > 0 ? (
        <Link href="/inventory/reorder" className="block rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm font-semibold text-danger hover:bg-danger/10">
          {t("belowMinBanner", { count: breaches.length })} →
        </Link>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-grey/20 bg-white p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("valueByWarehouse")}</h3>
          {valueByWh.length === 0 ? (
            <p className="text-sm text-grey">{t("empty")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {valueByWh.map(([wh, v]) => (
                <li key={wh} className="flex items-center justify-between">
                  <span className="font-semibold">{wh}</span>
                  <span className="tabular-nums">{Math.round(v).toLocaleString("en-US")} ₫</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-grey/20 bg-white p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("slowMovers")}</h3>
          {slowMovers.length === 0 ? (
            <p className="text-sm text-grey">{t("noSlowMovers")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {slowMovers.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>{r.wh} · {r.item}</span>
                  <span className="tabular-nums text-grey">{r.qty.toLocaleString("en-US")} {r.uom}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
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
