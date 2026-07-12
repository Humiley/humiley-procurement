"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Search, Download, X, ChevronRight, BadgeCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { HS_SECTIONS, HS_CHAPTERS, chapterInfo, sectionOfChapter } from "@/lib/trade/hs-structure";

export type HsRow = {
  id: string;
  code: string;
  en: string;
  vn: string;
  category: string | null;
  keywords: string | null;
  chapter: number | null;
  sectionNo: number | null;
  mfn: number;
  vat: number;
  dutyVerified: boolean;
  bestRoute: string | null;
  bestRoutePct: number | null;
  items: number;
};

/**
 * HS Code Explorer — search + filter the curated HS 2022 catalogue, browse the full
 * 21-section / 97-chapter nomenclature, and drill into any code. Filtering is client-side
 * over the server-provided rows (the catalogue is small and fully in memory).
 */
export function HsExplorer({ rows, chapterCounts }: { rows: HsRow[]; chapterCounts: Record<number, number> }) {
  const t = useTranslations("hs");
  const vi = useLocale() === "vi";
  const [view, setView] = useState<"codes" | "chapters">("codes");
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const [section, setSection] = useState(0); // 0 = all
  const [chapter, setChapter] = useState(0); // 0 = all
  const [tradedOnly, setTradedOnly] = useState(false);

  const categories = useMemo(
    () => Array.from(new Set(rows.map((r) => r.category).filter(Boolean) as string[])).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const digits = needle.replace(/\D/g, "");
    return rows.filter((r) => {
      if (tradedOnly && !r.dutyVerified) return false;
      if (category !== "all" && r.category !== category) return false;
      if (section !== 0 && r.sectionNo !== section) return false;
      if (chapter !== 0 && r.chapter !== chapter) return false;
      if (!needle) return true;
      const codeDigits = r.code.replace(/\D/g, "");
      return (
        (digits && codeDigits.includes(digits)) ||
        r.code.toLowerCase().includes(needle) ||
        r.en.toLowerCase().includes(needle) ||
        r.vn.toLowerCase().includes(needle) ||
        (r.category ?? "").toLowerCase().includes(needle) ||
        (r.keywords ?? "").toLowerCase().includes(needle)
      );
    });
  }, [rows, q, category, section, chapter, tradedOnly]);

  const activeChapter = chapter ? chapterInfo(chapter) : null;
  const hasFilters = q || category !== "all" || section !== 0 || chapter !== 0 || tradedOnly;

  function clearFilters() {
    setQ("");
    setCategory("all");
    setSection(0);
    setChapter(0);
    setTradedOnly(false);
  }

  function pickChapter(ch: number) {
    setChapter(ch);
    setSection(0);
    setCategory("all");
    setView("codes");
  }

  function exportCsv() {
    const head = ["HS code", "Description (EN)", "Description (VN)", "Chapter", "Category", "MFN %", "VAT %", "Duty verified", "Best route", "Linked items"];
    // Quote for CSV, and neutralise spreadsheet formula injection (a leading = + - @ tab CR).
    const esc = (v: unknown) => {
      let s = String(v ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const lines = filtered.map((r) =>
      [r.code, r.en, r.vn, r.chapter ?? "", r.category ?? "", r.dutyVerified ? r.mfn : "", r.dutyVerified ? r.vat : "", r.dutyVerified ? "yes" : "reference", r.bestRoute ? `${r.bestRoute} ${r.bestRoutePct}%` : "", r.items]
        .map(esc)
        .join(","),
    );
    const csv = [head.map(esc).join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "humiley-hs-codes.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-[22px]">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={t("statTotal")} value={rows.length} />
        <Stat label={t("statTraded")} value={rows.filter((r) => r.dutyVerified).length} accent />
        <Stat label={t("statCategories")} value={categories.length} />
        <Stat label={t("statChapters")} value={Object.keys(chapterCounts).length} />
      </div>

      {/* view switch */}
      <div className="inline-flex gap-1 rounded-xl bg-panel p-1">
        {(["codes", "chapters"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition",
              view === v ? "bg-navy text-white shadow-sm" : "text-grey hover:text-navy",
            )}
          >
            {v === "codes" ? t("viewCodes") : t("viewChapters")}
          </button>
        ))}
      </div>

      {view === "codes" ? (
        <div className="card">
          {/* toolbar */}
          <div className="flex flex-wrap items-center gap-2 rounded-t-card border-b border-line bg-panel p-3">
            <div className="relative min-w-[190px] max-w-[340px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-[13px] w-[13px] -translate-y-1/2 text-grey" />
              <input className="field w-full pl-8" placeholder={t("searchPlaceholder")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="field w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="all">{t("allCategories")}</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select className="field w-auto max-w-[240px]" value={section} onChange={(e) => setSection(Number(e.target.value))}>
              <option value={0}>{t("allSections")}</option>
              {HS_SECTIONS.map((s) => (
                <option key={s.no} value={s.no}>{s.roman}. {vi ? s.vn : s.en}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setTradedOnly((v) => !v)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-[14px] border px-3 py-[7px] text-[13px] font-semibold transition",
                tradedOnly ? "border-emerald bg-emerald/10 text-emerald" : "border-line text-grey hover:text-navy",
              )}
            >
              <BadgeCheck className="h-[15px] w-[15px]" /> {t("tradedOnly")}
            </button>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[13px] tabular-nums text-grey">{t("resultCount", { n: filtered.length })}</span>
              <button type="button" className="btn-outline" onClick={exportCsv}>
                <Download className="h-4 w-4" /> {t("exportCsv")}
              </button>
            </div>
          </div>

          {/* active chapter chip */}
          {activeChapter ? (
            <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[13px]">
              <span className="text-grey">{t("filteredBy")}:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-navy/10 px-2.5 py-1 font-semibold text-navy">
                {t("chapter")} {String(activeChapter.ch).padStart(2, "0")} · {vi ? activeChapter.vn : activeChapter.en}
                <button type="button" onClick={() => setChapter(0)} className="hover:text-navyDeep" aria-label={t("clear")}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          ) : null}

          {/* table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead>
                <tr className="th">
                  <th className="px-3 py-2.5">{t("colCode")}</th>
                  <th className="px-3 py-2.5">{t("colDesc")}</th>
                  <th className="px-3 py-2.5">{t("colChapter")}</th>
                  <th className="px-3 py-2.5">{t("colCategory")}</th>
                  <th className="px-3 py-2.5 text-right">{t("colDuty")}</th>
                  <th className="px-3 py-2.5">{t("colBestRoute")}</th>
                  <th className="px-3 py-2.5 text-right">{t("colItems")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0 hover:bg-grey/5">
                    <td className="px-3 py-2.5 text-sm font-semibold text-navy tabular-nums whitespace-nowrap">
                      <Link href={`/reference/hs-codes/${r.id}`} className="hover:underline">{r.code}</Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {r.en}
                      <span className="block text-xs italic text-grey">{r.vn}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums text-grey whitespace-nowrap">{r.chapter ? String(r.chapter).padStart(2, "0") : "—"}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.category ? <span className="rounded-full bg-navy/[0.07] px-2 py-0.5 text-xs font-medium text-navy">{r.category}</span> : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      {r.dutyVerified ? (
                        <span className="tabular-nums">{r.mfn}% <span className="text-grey">/ {r.vat}%</span></span>
                      ) : (
                        <span className="text-xs text-grey" title={t("referenceHint")}>{t("confirm")}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {r.bestRoute ? (
                        <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-xs font-bold text-emerald">{r.bestRoute}: {r.bestRoutePct}%</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.items || "—"}</td>
                  </tr>
                ))}
                {filtered.length > 200 ? (
                  <tr>
                    <td colSpan={7} className="bg-panel/60 px-3 py-3 text-center text-xs text-grey">
                      {t("cappedRows", { shown: 200, total: filtered.length })}
                    </td>
                  </tr>
                ) : null}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-3 py-10 text-center text-sm text-grey">
                      {t("noResults")}
                      {hasFilters ? <button type="button" onClick={clearFilters} className="ml-2 font-semibold text-navy hover:underline">{t("clearFilters")}</button> : null}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* chapter index — the full HS nomenclature backbone */
        <div className="space-y-3">
          <p className="text-[13px] text-grey">{t("chaptersIntro")}</p>
          {HS_SECTIONS.map((s) => (
            <SectionBlock key={s.no} sectionNo={s.no} chapterCounts={chapterCounts} onPick={pickChapter} t={t} vi={vi} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card p-4">
      <div className={cn("text-[26px] font-bold leading-none tabular-nums", accent ? "text-emerald" : "text-navy")}>{value}</div>
      <div className="mt-1 text-xs text-grey">{label}</div>
    </div>
  );
}

function SectionBlock({
  sectionNo,
  chapterCounts,
  onPick,
  t,
  vi,
}: {
  sectionNo: number;
  vi: boolean;
  chapterCounts: Record<number, number>;
  onPick: (ch: number) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const s = HS_SECTIONS.find((x) => x.no === sectionNo)!;
  const chapters = HS_CHAPTERS.filter((c) => sectionOfChapter(c.ch)?.no === sectionNo);
  const total = chapters.reduce((n, c) => n + (chapterCounts[c.ch] ?? 0), 0);
  const [open, setOpen] = useState(total > 0);

  return (
    <div className="card overflow-hidden">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-grey/5">
        <ChevronRight className={cn("h-4 w-4 flex-none text-grey transition-transform", open && "rotate-90")} />
        <span className="flex-none rounded-md bg-navy/10 px-2 py-0.5 text-xs font-bold text-navy tabular-nums">{s.roman}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-body">{s.en}</span>
          <span className="block truncate text-xs italic text-grey">{s.vn}</span>
        </span>
        <span className="flex-none text-xs text-grey tabular-nums">
          {t("chaptersRange", { from: String(s.from).padStart(2, "0"), to: String(s.to).padStart(2, "0") })}
          {total > 0 ? <span className="ml-2 rounded-full bg-emerald/10 px-2 py-0.5 font-semibold text-emerald">{total}</span> : null}
        </span>
      </button>
      {open ? (
        <div className="grid gap-1 border-t border-line p-2 sm:grid-cols-2 lg:grid-cols-3">
          {chapters.map((c) => {
            const count = chapterCounts[c.ch] ?? 0;
            return (
              <button
                key={c.ch}
                type="button"
                disabled={count === 0}
                onClick={() => onPick(c.ch)}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
                  count > 0 ? "hover:bg-navy/5" : "cursor-default opacity-45",
                )}
              >
                <span className="w-6 flex-none font-bold tabular-nums text-navy">{String(c.ch).padStart(2, "0")}</span>
                <span className="min-w-0 flex-1 truncate text-body">{vi ? c.vn : c.en}</span>
                {count > 0 ? <span className="flex-none rounded-full bg-navy/[0.07] px-1.5 text-[11px] font-semibold tabular-nums text-navy">{count}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
