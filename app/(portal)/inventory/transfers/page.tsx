import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §10b transfer register. */
export default async function TransfersPage() {
  const user = await requireUser();
  const t = await getTranslations("trf");
  const st = await getTranslations("status");
  const canCreate = hasAnyRole(user, ["WAREHOUSE", "ADMIN"]);

  const transfers = await db.stockTransfer.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      fromWarehouse: { select: { code: true } },
      toWarehouse: { select: { code: true } },
      createdBy: { select: { name: true } },
      lines: { select: { qty: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-navy">{t("listTitle")}</h1>
        {canCreate ? (
          <Link href="/inventory/transfers/new" className="rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90">
            {t("newButton")}
          </Link>
        ) : null}
      </div>
      {transfers.length === 0 ? (
        <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("route")}</th>
                <th className="px-3 py-2.5">{t("colBy")}</th>
                <th className="px-3 py-2.5">{t("colDate")}</th>
                <th className="px-3 py-2.5 text-right">{t("colQty")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((x) => (
                <tr key={x.id} className="border-b border-grey/10 last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">
                    <Link href={`/inventory/transfers/${x.id}`} className="hover:underline">{x.transferNumber}</Link>
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{x.fromWarehouse.code} → {x.toWarehouse.code}</td>
                  <td className="px-3 py-2.5">{x.createdBy.name}</td>
                  <td className="px-3 py-2.5">{formatVnDate(x.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{x.lines.reduce((s, l) => s + Number(l.qty), 0).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={x.status} label={st.has(x.status) ? st(x.status) : x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
