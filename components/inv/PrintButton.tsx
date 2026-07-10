"use client";

import { Printer } from "lucide-react";

/** Batch-print trigger for the §21 label sheet (browser print → Zebra stock via @page CSS). */
export function PrintButton({ label }: { label: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-primary"
    >
      <Printer className="h-4 w-4" /> {label}
    </button>
  );
}
