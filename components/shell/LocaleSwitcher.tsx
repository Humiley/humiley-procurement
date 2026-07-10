"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { setLocale } from "@/app/actions/session";
import type { Locale } from "@/i18n/request";

// Inline flag glyphs (no external assets) — mirrors the portal's flag language pills.
const FLAGS: Record<Locale, React.ReactNode> = {
  en: (
    // US flag (simplified stripes + canton)
    <svg viewBox="0 0 20 14" className="h-full w-full" aria-hidden="true">
      <rect width="20" height="14" fill="#fff" />
      <g fill="#b22234">
        {[0, 2.15, 4.3, 6.46, 8.6, 10.76, 12.9].map((y) => (
          <rect key={y} y={y} width="20" height="1.08" />
        ))}
      </g>
      <rect width="9" height="7.54" fill="#3c3b6e" />
    </svg>
  ),
  vi: (
    // Vietnam flag (red field + yellow star)
    <svg viewBox="0 0 20 14" className="h-full w-full" aria-hidden="true">
      <rect width="20" height="14" fill="#da251d" />
      <path
        fill="#ff0"
        d="M10 3.1l1.12 3.44h3.62l-2.93 2.13 1.12 3.44L10 8.98l-2.93 2.13 1.12-3.44L5.26 6.54h3.62z"
      />
    </svg>
  ),
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("locale");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div role="group" aria-label={t("label")} className="flex items-center gap-1.5">
      {(["en", "vi"] as const).map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            disabled={pending}
            aria-pressed={active}
            title={t(l)}
            className={cn(
              "inline-flex items-center gap-[5px] rounded-lg border px-[9px] py-[5px] text-[11px] font-bold uppercase transition",
              active ? "border-navy bg-navy text-white" : "border-line bg-white text-grey hover:border-navy hover:text-navy",
            )}
          >
            <span className="inline-flex h-[13px] w-[20px] shrink-0 overflow-hidden rounded-[2px]">
              {FLAGS[l]}
            </span>
            {l === "en" ? "EN" : "VI"}
          </button>
        );
      })}
    </div>
  );
}
