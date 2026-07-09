"use client";

import { useEffect } from "react";

/**
 * Warns before the page is unloaded (refresh, tab close, external navigation)
 * while a form has unsaved edits. In-app router navigation is NOT covered —
 * the App Router has no stable navigation-blocking API; beforeunload is the
 * standardised subset. The browser shows its own generic message; the
 * localized copy lives in messages common.unsavedWarn for any custom UI.
 */
export function useUnsavedGuard(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);
}
