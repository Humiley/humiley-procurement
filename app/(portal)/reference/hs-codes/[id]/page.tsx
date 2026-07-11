import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { chapterOf, chapterInfo, sectionOfChapter } from "@/lib/trade/hs-structure";

/** §20 HS-code detail — the duty × C/O form matrix + linked items + regulation notes. */
export default async function HsCodeDetailPage({ params }: { params: { id: string } }) {
  await requireUser();
  const t = await getTranslations("hs");

  const h = await db.hsCode.findUnique({
    where: { id: params.id },
    include: {
      duties: { include: { cooFormType: true }, orderBy: { preferentialDutyPct: "asc" } },
      itemTrades: { include: { item: { select: { id: true, code: true, nameEn: true } } } },
    },
  });
  if (!h) notFound();

  const chapter = chapterOf(h.code);
  const chInfo = chapterInfo(chapter);
  const section = sectionOfChapter(chapter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/reference/hs-codes" className="text-sm text-grey hover:text-navy">← {t("title")}</Link>
        <h1 className="page-title tabular-nums">HS {h.code}</h1>
        {h.category ? <span className="rounded-full bg-navy/[0.07] px-2.5 py-0.5 text-xs font-semibold text-navy">{h.category}</span> : null}
      </div>

      <div className="card p-4 text-sm">
        <p className="font-semibold">{h.descriptionEn}</p>
        <p className="text-xs italic text-grey">{h.descriptionVn}</p>
        {chInfo && section ? (
          <p className="mt-2 text-xs text-grey">
            {t("section")} {section.roman} · {t("chapter")} {String(chapter).padStart(2, "0")} — {chInfo.en}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-4 text-xs">
          {h.dutyVerified ? (
            <>
              <span>{t("colMfn")}: <b className="tabular-nums">{Number(h.mfnDutyPct)}%</b></span>
              <span>{t("colVat")}: <b className="tabular-nums">{Number(h.vatImportPct)}%</b></span>
            </>
          ) : null}
          {h.uomCustoms ? <span>{t("customsUom")}: <b>{h.uomCustoms}</b></span> : null}
        </div>
        {!h.dutyVerified ? (
          <p className="mt-2 rounded-lg bg-navy/[0.06] px-3 py-2 text-xs text-grey">{t("referenceHint")}</p>
        ) : null}
        {h.notes ? (
          <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">{t("regulationNote")}: <span className="font-normal text-body">{h.notes}</span></p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="label">{t("dutyMatrix")}</h3>
          {h.dutyVerified || h.duties.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="th">
                <th className="py-2">{t("route")}</th>
                <th className="py-2">{t("countries")}</th>
                <th className="py-2 text-right">{t("duty")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line">
                <td className="py-2 font-semibold">MFN</td>
                <td className="py-2 text-xs text-grey">{t("mfnAny")}</td>
                <td className="py-2 text-right font-semibold tabular-nums">{Number(h.mfnDutyPct)}%</td>
              </tr>
              {h.duties.map((d) => (
                <tr key={d.id} className="border-b border-line last:border-0">
                  <td className="py-2">
                    <span className="font-semibold">{d.cooFormType.code.replace("_", " ")}</span>
                    <span className="block text-xs text-grey">{d.cooFormType.agreementName}</span>
                  </td>
                  <td className="py-2 text-xs text-grey">{d.cooFormType.countries.join(", ") || "—"}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-emerald">{Number(d.preferentialDutyPct)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          ) : (
            <p className="text-sm text-grey">{t("referenceHint")}</p>
          )}
        </div>
        <div className="card p-4">
          <h3 className="label">{t("linkedItems")}</h3>
          {h.itemTrades.length === 0 ? (
            <p className="text-sm text-grey">{t("noItems")}</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {h.itemTrades.map((it) => (
                <li key={it.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-navy tabular-nums whitespace-nowrap">{it.item.code}</span>
                  <span>{it.item.nameEn}</span>
                  {it.originCountry ? <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-navy">{it.originCountry}</span> : null}
                  {it.requiresImportLicense ? <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[10px] font-bold text-warning">{t("license")}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
