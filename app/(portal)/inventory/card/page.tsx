import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDateTime } from "@/lib/dates";

const IN_TYPES = new Set(["GRN_IN", "TRANSFER_IN", "ADJUST_IN", "RETURN_IN"]);

/** §10b stock card — the movement ledger for one item in one warehouse, with a running balance. */
export default async function StockCardPage({ searchParams }: { searchParams: { wh?: string; item?: string } }) {
  await requireUser();
  const t = await getTranslations("inventory");
  if (!searchParams.wh || !searchParams.item) notFound();

  const [warehouse, item, movements, balance] = await Promise.all([
    db.warehouse.findUnique({ where: { id: searchParams.wh } }),
    db.item.findUnique({ where: { id: searchParams.item }, include: { uom: { select: { code: true } } } }),
    db.stockMovement.findMany({
      where: { warehouseId: searchParams.wh, itemId: searchParams.item },
      orderBy: { postedAt: "asc" },
      include: { createdBy: { select: { name: true } } },
    }),
    db.stockBalance.findFirst({ where: { warehouseId: searchParams.wh, itemId: searchParams.item } }),
  ]);
  if (!warehouse || !item) notFound();

  let running = 0;
  const rows = movements.map((m) => {
    const qty = Number(decToString(m.qty, 4));
    const signed = IN_TYPES.has(m.type) ? qty : -qty;
    running += signed;
    return {
      id: m.id,
      number: m.movementNumber,
      when: formatVnDateTime(m.postedAt),
      type: m.type,
      isIn: IN_TYPES.has(m.type),
      qty,
      unitCost: Number(decToString(m.unitCostVnd, 2)),
      ref: m.note || m.refEntityType || "—",
      by: m.createdBy.name,
      balance: running,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory" className="text-sm text-grey hover:text-navy">← {t("title")}</Link>
        <h1 className="page-title">{t("stockCard")}</h1>
        <span className="rounded bg-navy/10 px-2 py-0.5 text-xs font-bold text-navy">{warehouse.code}</span>
        <span className="text-sm text-body">{item.code} · {item.nameEn}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 card p-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-grey">{t("colOnHand")}</dt>
          <dd className="mt-0.5 text-lg font-bold text-navy">
            {balance ? Number(decToString(balance.qtyOnHand, 4)).toLocaleString("en-US") : 0} {item.uom.code}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-grey">{t("colAvgCost")}</dt>
          <dd className="mt-0.5 text-lg font-bold text-navy">
            {balance ? Number(decToString(balance.avgCostVnd, 2)).toLocaleString("en-US") : 0} ₫
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-grey">{t("colValue")}</dt>
          <dd className="mt-0.5 text-lg font-bold text-navy">
            {balance ? Math.round(Number(decToString(balance.qtyOnHand, 4)) * Number(decToString(balance.avgCostVnd, 2))).toLocaleString("en-US") : 0} ₫
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-grey">{t("movements")}</dt>
          <dd className="mt-0.5 text-lg font-bold text-navy">{rows.length.toLocaleString("en-US")}</dd>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("noMovements")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="th">
                <th className="px-3 py-2.5">{t("colMovement")}</th>
                <th className="px-3 py-2.5">{t("colDate")}</th>
                <th className="px-3 py-2.5">{t("colType")}</th>
                <th className="px-3 py-2.5 text-right">{t("colIn")}</th>
                <th className="px-3 py-2.5 text-right">{t("colOut")}</th>
                <th className="px-3 py-2.5 text-right">{t("colUnitCost")}</th>
                <th className="px-3 py-2.5 text-right">{t("colBalance")}</th>
                <th className="px-3 py-2.5">{t("colRef")}</th>
                <th className="px-3 py-2.5">{t("colBy")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">{r.number}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{r.when}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${r.isIn ? "bg-emerald/10 text-emerald" : "bg-danger/10 text-danger"}`}>
                      {t(`type.${r.type}`)}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald">{r.isIn ? r.qty.toLocaleString("en-US") : ""}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-danger">{!r.isIn ? r.qty.toLocaleString("en-US") : ""}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{r.unitCost.toLocaleString("en-US")} ₫</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{r.balance.toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{r.ref}</td>
                  <td className="px-3 py-2.5">{r.by}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
