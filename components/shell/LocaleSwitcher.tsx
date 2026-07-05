"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { cn } from "@/lib/cn";
import { setLocale } from "@/app/actions/session";
import type { Locale } from "@/i18n/request";

export function LocaleSwitcher() {
  const locale = useLocale();
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
    <div className="flex items-center rounded-md border border-grey/25 text-xs">
      <Globe className="ml-2 h-3.5 w-3.5 text-grey" />
      {(["en", "vi"] as const).map((l) => (
        <button
          key={l}
          onClick={() => choose(l)}
          disabled={pending}
          className={cn(
            "px-2 py-1 font-semibold uppercase transition",
            l === locale ? "text-navy" : "text-grey hover:text-body",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
