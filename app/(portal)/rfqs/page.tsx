import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §8 RFQ register. */
export default async function RfqsPage() {
  const user = await requireUser();
  const t = await getTranslations("rfq");
  const st = await getTranslations("status");
  const canCreate = hasAnyRole(user, ["PURCHASER", "ADMIN"]);

  const rfqs = await db.rfq.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      pr: { select: { prNumber: true } },
      vendors: { select: { respondedAt: true } },
      quotes: { select: { id: true } },
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("listTitle")}</h1>
        {canCreate ? (
          <Link href="/rfqs/new" className="btn-primary">
            {t("newButton")}
          </Link>
        ) : null}
      </div>

      <HowItWorks guide="rfqs" />
      {rfqs.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="th">
                <th className="px-3 py-2.5">{t("colNo")}</th>
                <th className="px-3 py-2.5">{t("title")}</th>
                <th className="px-3 py-2.5">{t("colPr")}</th>
                <th className="px-3 py-2.5">{t("dueDate")}</th>
                <th className="px-3 py-2.5 text-center">{t("colQuotes")}</th>
                <th className="px-3 py-2.5">{t("colStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 text-sm font-semibold text-navy tabular-nums whitespace-nowrap">
                    <Link href={`/rfqs/${r.id}`} className="hover:underline">{r.rfqNumber}</Link>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2.5">{r.title}</td>
                  <td className="px-3 py-2.5 text-xs tabular-nums">{r.pr?.prNumber || "—"}</td>
                  <td className="px-3 py-2.5">{formatVnDate(r.dueDate)}</td>
                  <td className="px-3 py-2.5 text-center">{r.quotes.length} / {r.vendors.length}</td>
                  <td className="px-3 py-2.5"><StatusBadge status={r.status} label={st.has(r.status) ? st(r.status) : r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
