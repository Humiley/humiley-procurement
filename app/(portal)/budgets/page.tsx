import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { currentFiscalYear } from "@/lib/dates";

/** §9 budget dashboard — spent / committed / remaining per cost center × category. */
export default async function BudgetsPage() {
  await requireRoles("ADMIN", "DIRECTOR", "ACCOUNTANT", "PURCHASER", "DEPT_MANAGER");
  const t = await getTranslations("budgets");
  const fy = currentFiscalYear();

  const budgets = await db.budget.findMany({
    where: { fiscalYear: fy },
    include: { costCenter: { select: { code: true, nameEn: true } }, category: { select: { code: true, nameEn: true } } },
    orderBy: [{ costCenter: { code: "asc" } }, { category: { code: "asc" } }],
  });

  const n = (v: unknown) => Number(v as never) || 0;
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-navy">{t("title", { fy })}</h1>
      {budgets.length === 0 ? (
        <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const total = n(b.amountVnd), spent = n(b.spentVnd), committed = n(b.committedVnd);
            const remaining = Math.max(0, total - spent - committed);
            const over = spent + committed > total;
            const pct = (v: number) => (total > 0 ? Math.min(100, (v / total) * 100) : 0);
            return (
              <div key={b.id} className="rounded-xl border border-grey/20 bg-white p-4">
                <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-semibold text-navy">
                    {b.costCenter.code} · {b.costCenter.nameEn}
                    <span className="ml-2 rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-navy">{b.category.code}</span>
                  </span>
                  <span className="text-xs text-grey">
                    {t("budget")}: <b className="text-body">{n(b.amountVnd).toLocaleString("en-US")} ₫</b>
                    {over ? <span className="ml-2 rounded bg-danger/10 px-1.5 py-0.5 font-bold text-danger">{t("over")}</span> : null}
                  </span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-grey/15" title={`${t("spent")} ${spent.toLocaleString("en-US")} · ${t("committed")} ${committed.toLocaleString("en-US")}`}>
                  <div className="h-full bg-navy" style={{ width: `${pct(spent)}%` }} />
                  <div className="h-full bg-warning" style={{ width: `${pct(committed)}%` }} />
                </div>
                <div className="mt-1.5 flex flex-wrap gap-4 text-[11px] text-grey">
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-navy" />{t("spent")}: {spent.toLocaleString("en-US")}</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-warning" />{t("committed")}: {committed.toLocaleString("en-US")}</span>
                  <span><span className="mr-1 inline-block h-2 w-2 rounded-full bg-grey/40" />{t("remaining")}: {remaining.toLocaleString("en-US")}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
