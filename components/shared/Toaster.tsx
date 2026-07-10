"use client";

import { useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";

type Toast = { id: number; msg: string };

let pushToast: ((msg: string) => void) | null = null;

/**
 * Fire a success toast from anywhere client-side. Pass an already-translated
 * string (callers own the namespace). No-ops if the Toaster is not mounted.
 */
export function toast(msg: string) {
  pushToast?.(msg);
}

/** Mounted once in the portal layout — bottom-center, aria-live, auto-dismiss. */
export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    pushToast = (msg) => {
      const id = Date.now() + Math.random();
      setItems((s) => [...s.slice(-2), { id, msg }]);
      setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 4000);
    };
    return () => {
      pushToast = null;
    };
  }, []);

  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-6 right-6 z-[70] flex flex-col items-end gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="fade-up flex max-w-[340px] items-center gap-2 rounded-[10px] bg-navyDeep px-[18px] py-3 text-[13px] font-semibold text-white shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald" />
          {t.msg}
        </div>
      ))}
    </div>
  );
}
