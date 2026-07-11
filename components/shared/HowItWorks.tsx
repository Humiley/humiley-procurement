"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { HelpCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { GUIDES } from "@/lib/guides";

/**
 * Collapsible "How it works" panel — a short overview + the step-by-step process for the
 * module, from lib/guides.ts. Renders EN or VN by the active locale. Collapsed by default so
 * it never gets in the way; the overview shows as a teaser on the header.
 */
export function HowItWorks({ guide, defaultOpen = false }: { guide: string; defaultOpen?: boolean }) {
  const t = useTranslations("guide");
  const locale = useLocale();
  const [open, setOpen] = useState(defaultOpen);
  const g = GUIDES[guide]?.[locale === "vi" ? "vn" : "en"] ?? GUIDES[guide]?.en;
  if (!g) return null;

  return (
    <div className="card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-grey/5"
        aria-expanded={open}
      >
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-navy/10 text-navy">
          <HelpCircle className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-navy">{t("how")}</span>
          {!open ? <span className="block truncate text-xs text-grey">{g.overview}</span> : null}
        </span>
        <ChevronDown className={cn("h-4 w-4 flex-none text-grey transition-transform", open && "rotate-180")} />
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4 text-sm">
          <p className="text-body">{g.overview}</p>

          <ol className="space-y-2.5">
            {g.steps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-navy text-[11px] font-bold tabular-nums text-white">{i + 1}</span>
                <span className="leading-snug">
                  <span className="font-semibold text-body">{s.t}</span>
                  <span className="text-grey"> — {s.d}</span>
                </span>
              </li>
            ))}
          </ol>

          {g.roles?.length ? (
            <div>
              <h4 className="label mb-1.5">{t("roles")}</h4>
              <ul className="space-y-1">
                {g.roles.map((r, i) => (
                  <li key={i} className="text-[13px]">
                    <span className="rounded bg-navy/[0.07] px-1.5 py-0.5 text-xs font-semibold text-navy">{r.who}</span>{" "}
                    <span className="text-grey">{r.can}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {g.tips?.length ? (
            <div className="rounded-lg bg-emerald/[0.07] px-3 py-2.5">
              <h4 className="mb-1 text-xs font-bold text-emerald">{t("tips")}</h4>
              <ul className="list-inside list-disc space-y-0.5 text-[13px] text-body/80">
                {g.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
