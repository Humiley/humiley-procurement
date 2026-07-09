"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { cn } from "@/lib/cn";
import { setLocale } from "@/app/actions/session";
import type { Locale } from "@/i18n/request";

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
    <div
      role="group"
      aria-label={t("label")}
      className="flex items-center rounded-md border border-grey/25 text-xs"
    >
      <Globe className="ml-2 h-3.5 w-3.5 shrink-0 text-grey" />
      {(["en", "vi"] as const).map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            onClick={() => choose(l)}
            disabled={pending}
            aria-pressed={active}
            aria-label={t(l)}
            title={t(l)}
            className={cn(
              "min-h-10 px-3 py-2 font-semibold uppercase transition",
              active ? "text-navy" : "text-grey hover:text-body",
            )}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
