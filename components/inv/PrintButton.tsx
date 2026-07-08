"use client";

import { Printer } from "lucide-react";

/** Batch-print trigger for the §21 label sheet (browser print → Zebra stock via @page CSS). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
