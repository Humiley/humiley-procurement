"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Download, FileSpreadsheet } from "lucide-react";
import { exportAccountingBatch } from "@/app/(portal)/admin/export.actions";
import { act } from "@/lib/act";

export type ExportBatchRow = { batchNumber: string; kind: string; rowCount: number; by: string; at: string };

/** §17 accounting export — batch CSV download; exported rows are stamped and never re-export. */
export function ExportPanel({ invoiceCount, paymentCount, batches }: { invoiceCount: number; paymentCount: number; batches: ExportBatchRow[] }) {
  const t = useTranslations("acctExport");
  const fmtErr = useActionError();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runExport(kind: "INVOICES" | "PAYMENT_REQUESTS") {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = act(await exportAccountingBatch(kind));
      const blob = new Blob(["﻿" + res.csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${res.batchNumber}-${kind.toLowerCase()}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMsg(t("done", { batch: res.batchNumber, rows: res.rowCount }));
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {msg ? <p className="rounded-lg bg-emerald/10 px-3 py-2 text-sm text-emerald">{msg}</p> : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {[
          { kind: "INVOICES" as const, count: invoiceCount, title: t("invoicesTitle"), desc: t("invoicesDesc") },
          { kind: "PAYMENT_REQUESTS" as const, count: paymentCount, title: t("paymentsTitle"), desc: t("paymentsDesc") },
        ].map((c) => (
          <div key={c.kind} className="card p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-navy"><FileSpreadsheet className="h-4 w-4" /> {c.title}</h3>
            <p className="mt-1 text-xs text-grey">{c.desc}</p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-navy">{c.count}</p>
            <button
              type="button"
              disabled={busy || c.count === 0}
              onClick={() => runExport(c.kind)}
              className="btn-emerald mt-3"
            >
              <Download className="h-4 w-4" /> {t("exportCsv")}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("history")}</h3>
        {batches.length === 0 ? (
          <p className="text-sm text-grey">{t("noBatches")}</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {batches.map((b) => (
              <li key={b.batchNumber} className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-bold text-navy">{b.batchNumber}</span>
                <span className="rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold text-navy">{b.kind}</span>
                <span className="tabular-nums">{b.rowCount} {t("rows")}</span>
                <span className="text-xs text-grey">{b.by} · {b.at}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
