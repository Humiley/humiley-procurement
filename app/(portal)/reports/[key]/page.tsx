import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { requireRoles } from "@/lib/rbac";
import { currentFiscalYear } from "@/lib/dates";
import { REPORTS } from "@/lib/kpi/reports";

/** §10-G report viewer — FY filter + xlsx export of exactly what is on screen. */
export default async function ReportPage({ params, searchParams }: { params: { key: string }; searchParams: { fy?: string } }) {
  await requireRoles("ADMIN", "DIRECTOR", "ACCOUNTANT", "PURCHASER", "DEPT_MANAGER");
  const report = REPORTS[params.key];
  if (!report) notFound();
  const t = await getTranslations("reports");
  const fy = Number(searchParams.fy) || currentFiscalYear();

  const table = await report.fn(fy);
  const years = [fy - 2, fy - 1, fy, fy + 1].filter((y) => y >= 2024);
  const numeric = (v: string | number) => typeof v === "number" || /^[\d,.\-]+%?$/.test(String(v));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/reports" className="text-sm text-grey hover:text-navy">← {t("title")}</Link>
        <h1 className="text-lg font-bold text-navy">{t(`names.${params.key}`)}</h1>
        <span className="flex-1" />
        <form className="flex items-center gap-2">
          <select name="fy" defaultValue={fy} className="field">
            {years.map((y) => (
              <option key={y} value={y}>FY {y}</option>
            ))}
          </select>
          <button type="submit" className="btn-outline">{t("apply")}</button>
        </form>
        <a
          href={`/api/reports/${params.key}?fy=${fy}`}
          className="flex items-center gap-1.5 rounded-lg bg-emerald px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
        >
          <Download className="h-4 w-4" /> {t("exportXlsx")}
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              {table.columns.map((c) => (
                <th key={c} className="px-3 py-2.5">{t(`cols.${c}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.length === 0 ? (
              <tr><td colSpan={table.columns.length} className="px-3 py-6 text-center text-grey">{t("empty")}</td></tr>
            ) : (
              table.rows.map((row, i) => (
                <tr key={i} className="border-b border-grey/10 last:border-0 hover:bg-grey/5">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-3 py-2 ${j > 0 && numeric(cell) ? "text-right tabular-nums" : ""}`}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-grey">{t("rowCount", { count: table.rows.length })}</p>
    </div>
  );
}
