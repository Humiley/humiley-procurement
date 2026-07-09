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
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-[70] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="fade-up flex items-center gap-2 rounded-lg bg-navy px-4 py-2.5 text-sm font-medium text-white shadow-card-hover"
        >
          <CheckCircle2 className="h-4 w-4 text-emerald" />
          {t.msg}
        </div>
      ))}
    </div>
  );
}
