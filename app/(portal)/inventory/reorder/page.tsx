import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { findReorderBreaches } from "@/lib/stock/reorder";
import { ReorderPanel, type ReorderOpt } from "@/components/inv/ReorderPanel";

/** §10b reorder console — every below-min breach with one-click draft-PR generation. */
export default async function ReorderPage() {
  const user = await requireUser();
  const t = await getTranslations("reorder");
  const canGenerate = hasAnyRole(user, ["PURCHASER", "ADMIN"]);

  const [breaches, costCenters] = await Promise.all([
    findReorderBreaches(),
    db.costCenter.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory" className="text-sm text-grey hover:text-navy">← {t("backToInventory")}</Link>
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
      </div>
      <ReorderPanel
        breaches={breaches}
        costCenters={costCenters.map((c): ReorderOpt => ({ id: c.id, label: `${c.code} · ${c.nameEn}` }))}
        canGenerate={canGenerate}
      />
    </div>
  );
}
