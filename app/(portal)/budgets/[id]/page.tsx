import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";

/** §9 budget drill-down — the row's ledger + every PR line that resolves to it. */
export default async function BudgetDetailPage({ params }: { params: { id: string } }) {
  await requireRoles("ADMIN", "DIRECTOR", "ACCOUNTANT", "PURCHASER", "DEPT_MANAGER");
  const t = await getTranslations("budgets");
  const st = await getTranslations("status");

  const b = await db.budget.findUnique({
    where: { id: params.id },
    include: { costCenter: { select: { id: true, code: true, nameEn: true } }, category: { select: { id: true, code: true, nameEn: true } } },
  });
  if (!b) notFound();

  // PR lines that resolve to this budget: explicitly, or by costCenter × item.category
  const lines = await db.prLine.findMany({
    where: {
      OR: [
        { budgetId: b.id },
        { pr: { costCenterId: b.costCenter.id }, item: { categoryId: b.category.id } },
      ],
    },
    include: {
      pr: { select: { id: true, prNumber: true, status: true, createdAt: true, requester: { select: { name: true } } } },
      item: { select: { code: true, nameEn: true } },
    },
    orderBy: { pr: { createdAt: "desc" } },
  });

  const n = (v: unknown) => Number(v as never) || 0;
  const total = n(b.amountVnd), spent = n(b.spentVnd), committed = n(b.committedVnd);
  const remaining = total - spent - committed;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/budgets" className="text-sm text-grey hover:text-navy">← {t("title", { fy: b.fiscalYear })}</Link>
        <h1 className="text-lg font-bold text-navy">
          {b.costCenter.code} · {b.costCenter.nameEn}
          <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-xs font-bold text-navy">{b.category.code}</span>
          <span className="ml-2 text-sm font-normal text-grey">FY {b.fiscalYear}</span>
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [t("budget"), total, "text-navy"],
          [t("spent"), spent, "text-navy"],
          [t("committed"), committed, "text-warning"],
          [t("remaining"), remaining, remaining < 0 ? "text-danger" : "text-emerald"],
        ].map(([label, v, cls]) => (
          <div key={label as string} className="rounded-xl border border-grey/20 bg-white p-4">
            <dt className="text-xs uppercase tracking-wide text-grey">{label as string}</dt>
            <dd className={`mt-0.5 text-lg font-bold tabular-nums ${cls as string}`}>{(v as number).toLocaleString("en-US")} ₫</dd>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              <th className="px-3 py-2.5">{t("colPr")}</th>
              <th className="px-3 py-2.5">{t("colItem")}</th>
              <th className="px-3 py-2.5">{t("colRequester")}</th>
              <th className="px-3 py-2.5">{t("colDate")}</th>
              <th className="px-3 py-2.5 text-right">{t("colAmount")}</th>
              <th className="px-3 py-2.5">{t("colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-grey">{t("noLines")}</td></tr>
            ) : (
              lines.map((l) => (
                <tr key={l.id} className="border-b border-grey/10 last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">
                    <Link href={`/requisitions/${l.pr.id}`} className="hover:underline">{l.pr.prNumber}</Link>
                  </td>
                  <td className="px-3 py-2.5">{l.item ? `${l.item.code} · ${l.item.nameEn}` : l.freeTextDescription || "—"}</td>
                  <td className="px-3 py-2.5">{l.pr.requester.name}</td>
                  <td className="px-3 py-2.5">{formatVnDate(l.pr.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    {(Number(decToString(l.qty, 4)) * Number(decToString(l.estUnitPriceVnd, 2))).toLocaleString("en-US")} ₫
                  </td>
                  <td className="px-3 py-2.5"><StatusBadge status={l.pr.status} label={st.has(l.pr.status) ? st(l.pr.status) : l.pr.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
