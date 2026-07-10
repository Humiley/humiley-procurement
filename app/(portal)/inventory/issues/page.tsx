import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §10b goods-issue register. */
export default async function GoodsIssuesPage() {
  await requireUser();
  const t = await getTranslations("gi");
  const st = await getTranslations("status");

  const issues = await db.goodsIssue.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      requester: { select: { name: true } },
      department: { select: { code: true } },
      warehouse: { select: { code: true } },
      lines: { select: { qtyRequested: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("listTitle")}</h1>
        <Link href="/inventory/issues/new" className="btn-primary">
          {t("newButton")}
        </Link>
      </div>
      {issues.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="th">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("warehouse")}</th>
                <th className="px-3 py-2.5">{t("colRequester")}</th>
                <th className="px-3 py-2.5">{t("purpose")}</th>
                <th className="px-3 py-2.5">{t("colDate")}</th>
                <th className="px-3 py-2.5 text-right">{t("colQty")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((g) => {
                const req = g.lines.reduce((s, l) => s + Number(l.qtyRequested), 0);
                return (
                  <tr key={g.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                    <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">
                      <Link href={`/inventory/issues/${g.id}`} className="hover:underline">{g.issueNumber}</Link>
                    </td>
                    <td className="px-3 py-2.5">{g.warehouse.code}</td>
                    <td className="px-3 py-2.5">{g.requester.name} <span className="text-grey">· {g.department.code}</span></td>
                    <td className="max-w-[220px] truncate px-3 py-2.5">{g.purpose}</td>
                    <td className="px-3 py-2.5">{formatVnDate(g.createdAt)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{req.toLocaleString("en-US")}</td>
                    <td className="px-3 py-2.5"><StatusBadge status={g.status} label={st.has(g.status) ? st(g.status) : g.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
