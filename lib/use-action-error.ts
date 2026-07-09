"use client";

import { useTranslations } from "next-intl";

/**
 * Shared catch-block formatter for client components calling server actions:
 * real Error messages pass through (the server's message is the most specific
 * information available), anything else falls back to the localized generic.
 */
export function useActionError() {
  const t = useTranslations("common");
  return (e: unknown) => (e instanceof Error ? e.message : t("actionFailed"));
}
