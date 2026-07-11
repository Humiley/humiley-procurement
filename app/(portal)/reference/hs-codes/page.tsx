import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { chapterOf, sectionOfChapter } from "@/lib/trade/hs-structure";
import { HsExplorer, type HsRow } from "@/components/reference/HsExplorer";
import { HsImportPanel } from "@/components/reference/HsImportPanel";

/** §20 HS-code register — searchable/filterable HS 2022 catalogue + full chapter index. */
export default async function HsCodesPage() {
  const user = await requireUser();
  const t = await getTranslations("hs");
  const canImport = hasAnyRole(user, ["ADMIN", "PURCHASER"]);

  const codes = await db.hsCode.findMany({
    orderBy: { code: "asc" },
    include: { duties: { include: { cooFormType: true } }, itemTrades: { select: { id: true } } },
  });

  const rows: HsRow[] = codes.map((h) => {
    const chapter = chapterOf(h.code);
    const best = h.duties.slice().sort((a, b) => Number(a.preferentialDutyPct) - Number(b.preferentialDutyPct))[0];
    return {
      id: h.id,
      code: h.code,
      en: h.descriptionEn,
      vn: h.descriptionVn,
      category: h.category,
      keywords: h.keywords,
      chapter,
      sectionNo: sectionOfChapter(chapter)?.no ?? null,
      mfn: Number(h.mfnDutyPct),
      vat: Number(h.vatImportPct),
      dutyVerified: h.dutyVerified,
      bestRoute: best ? best.cooFormType.code.replace("_", " ") : null,
      bestRoutePct: best ? Number(best.preferentialDutyPct) : null,
      items: h.itemTrades.length,
    };
  });

  const chapterCounts: Record<number, number> = {};
  for (const r of rows) if (r.chapter) chapterCounts[r.chapter] = (chapterCounts[r.chapter] ?? 0) + 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="mt-0.5 text-sm text-grey">{t("subtitle")}</p>
        </div>
        {canImport ? <HsImportPanel /> : null}
      </div>
      <HsExplorer rows={rows} chapterCounts={chapterCounts} />
    </div>
  );
}
