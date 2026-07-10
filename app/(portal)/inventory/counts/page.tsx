import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { NewCountButton } from "@/components/inv/NewCountButton";

/** §10b stock-count register. */
export default async function CountsPage() {
  const user = await requireUser();
  const t = await getTranslations("cnt");
  const st = await getTranslations("status");
  const canCreate = hasAnyRole(user, ["WAREHOUSE", "ADMIN"]);

  const [counts, warehouses] = await Promise.all([
    db.stockCount.findMany({
      orderBy: { countDate: "desc" },
      include: { warehouse: { select: { code: true } }, lines: { select: { varianceQty: true } } },
    }),
    canCreate ? db.warehouse.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }) : [],
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">{t("listTitle")}</h1>
        {canCreate ? <NewCountButton warehouses={warehouses.map((w) => ({ id: w.id, label: `${w.code} · ${w.nameEn}` }))} /> : null}
      </div>
      {counts.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("colWarehouse")}</th>
                <th className="px-3 py-2.5">{t("colDate")}</th>
                <th className="px-3 py-2.5 text-right">{t("colLines")}</th>
                <th className="px-3 py-2.5 text-right">{t("colVariances")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((c) => (
                <tr key={c.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">
                    <Link href={`/inventory/counts/${c.id}`} className="hover:underline">{c.countNumber}</Link>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{c.warehouse.code}</td>
                  <td className="px-3 py-2.5">{formatVnDate(c.countDate)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.lines.length}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.lines.filter((l) => Number(l.varianceQty) !== 0).length}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={c.status} label={st.has(c.status) ? st(c.status) : c.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
