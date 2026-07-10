import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { INCOTERMS_BOOK } from "@/lib/trade/incoterms";

/** §20 Incoterms 2020 book — all 11 terms, responsibility matrix, bilingual, VN import notes. */
export default async function IncotermsPage() {
  await requireUser();
  const t = await getTranslations("incoterms");
  const cell = (v: string) => (v === "S" ? t("seller") : v === "B" ? t("buyer") : "—");
  const cellCls = (v: string) => (v === "S" ? "text-emerald" : v === "B" ? "text-navy" : "text-grey");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-grey">{t("subtitle")}</p>
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-grey">
              <th className="px-3 py-2.5">{t("term")}</th>
              <th className="px-3 py-2.5">{t("mode")}</th>
              <th className="px-3 py-2.5">{t("exportClearance")}</th>
              <th className="px-3 py-2.5">{t("mainCarriage")}</th>
              <th className="px-3 py-2.5">{t("insurance")}</th>
              <th className="px-3 py-2.5">{t("importClearance")}</th>
              <th className="px-3 py-2.5">{t("importDuties")}</th>
            </tr>
          </thead>
          <tbody>
            {INCOTERMS_BOOK.map((i) => (
              <tr key={i.code} className="border-b border-line last:border-0 hover:bg-grey/5">
                <td className="px-3 py-2.5">
                  <span className="font-mono text-sm font-bold text-navy">{i.code}</span>
                  <span className="ml-2">{i.nameEn}</span>
                  <span className="block text-xs italic text-grey">{i.nameVn}</span>
                </td>
                <td className="px-3 py-2.5">{i.mode === "sea" ? t("seaOnly") : t("anyMode")}</td>
                {[i.exportClearance, i.mainCarriage, i.insurance, i.importClearance, i.importDuties].map((v, j) => (
                  <td key={j} className={`px-3 py-2.5 font-semibold ${cellCls(v)}`}>{cell(v)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {INCOTERMS_BOOK.map((i) => (
          <div key={i.code} id={i.code} className="card p-4">
            <h3 className="text-sm font-bold text-navy">
              <span className="font-mono">{i.code}</span> — {i.nameEn} <span className="font-normal italic text-grey">/ {i.nameVn}</span>
            </h3>
            <p className="mt-1 text-sm">{i.summaryEn}</p>
            <p className="text-xs italic text-grey">{i.summaryVn}</p>
            <p className="mt-2 text-xs"><b className="text-grey">{t("riskTransfer")}:</b> {i.riskTransferEn}</p>
            <p className="mt-1 rounded-lg bg-emerald/5 px-2 py-1.5 text-xs">
              <b className="text-emerald">{t("buyerNote")}:</b> {i.buyerNoteEn}
              <span className="block italic text-grey">{i.buyerNoteVn}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
