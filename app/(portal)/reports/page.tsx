import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { BarChart3 } from "lucide-react";
import { REPORT_KEYS } from "@/lib/kpi/reports";

/** §10-G report index — every report opens filtered on screen and exports to xlsx. */
export default async function ReportsPage() {
  await requireRoles("ADMIN", "DIRECTOR", "ACCOUNTANT", "PURCHASER", "DEPT_MANAGER");
  const t = await getTranslations("reports");

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_KEYS.map((key) => (
          <Link key={key} href={`/reports/${key}`} className="card flex items-center gap-3 p-4 transition hover:shadow-md">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy/10 text-navy">
              <BarChart3 className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">{t(`names.${key}`)}</span>
              <span className="block text-xs text-grey">{t(`descs.${key}`)}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
