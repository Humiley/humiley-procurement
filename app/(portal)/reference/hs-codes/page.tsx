import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";

/** §20 HS-code register — MFN/VAT, best preferential route, linked items. */
export default async function HsCodesPage() {
  await requireUser();
  const t = await getTranslations("hs");

  const codes = await db.hsCode.findMany({
    orderBy: { code: "asc" },
    include: { duties: { include: { cooFormType: true } }, itemTrades: { select: { id: true } } },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-grey">{t("subtitle")}</p>
      </div>
      <div className="overflow-x-auto card">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="th">
              <th className="px-3 py-2.5">{t("colCode")}</th>
              <th className="px-3 py-2.5">{t("colDesc")}</th>
              <th className="px-3 py-2.5 text-right">{t("colMfn")}</th>
              <th className="px-3 py-2.5 text-right">{t("colVat")}</th>
              <th className="px-3 py-2.5">{t("colBestRoute")}</th>
              <th className="px-3 py-2.5 text-right">{t("colItems")}</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((h) => {
              const best = h.duties.slice().sort((a, b) => Number(a.preferentialDutyPct) - Number(b.preferentialDutyPct))[0];
              return (
                <tr key={h.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-mono text-sm font-bold text-navy">
                    <Link href={`/reference/hs-codes/${h.id}`} className="hover:underline">{h.code}</Link>
                  </td>
                  <td className="px-3 py-2.5">
                    {h.descriptionEn}
                    <span className="block text-xs italic text-grey">{h.descriptionVn}</span>
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{Number(h.mfnDutyPct)}%</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{Number(h.vatImportPct)}%</td>
                  <td className="px-3 py-2.5">
                    {best ? (
                      <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-xs font-bold text-emerald">
                        {best.cooFormType.code.replace("_", " ")}: {Number(best.preferentialDutyPct)}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{h.itemTrades.length}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
