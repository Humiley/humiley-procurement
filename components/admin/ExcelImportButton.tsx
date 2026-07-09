"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Upload, FileDown, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

/**
 * Bulk import for items / vendors (spec §17). Uploads .xlsx or .csv to /api/admin/import and
 * shows a summary. Includes a header-only CSV template (opens in Excel) so users start correct.
 */
export function ExcelImportButton({
  kind,
  label,
  templateHeaders,
}: {
  kind: "items" | "vendors";
  label: string;
  templateHeaders: string[];
}) {
  const t = useTranslations("excelImport");
  const tc = useTranslations("common");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  function downloadTemplate() {
    const csv = "﻿" + templateHeaders.join(",") + "\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${kind}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/import?kind=${kind}`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? t("failed"));
      setResult(json as ImportResult);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("failed"));
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <div className="flex items-center gap-1">
        <button className="btn-outline" onClick={downloadTemplate} type="button" title={t("template")} aria-label={t("template")}>
          <FileDown className="h-4 w-4" />
        </button>
        <button
          className="btn-outline"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          type="button"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {label}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.csv"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {(result || error) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,56,102,0.45)] p-4">
          <div className="card w-full max-w-md p-5">
            {error ? (
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="font-semibold text-danger">{t("failedTitle")}</p>
                  <p className="mt-1 text-sm text-body">{error}</p>
                </div>
              </div>
            ) : result ? (
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald" />
                  <p className="font-semibold text-navy">{t("completeTitle")}</p>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-md bg-panel p-2">
                    <p className="text-lg font-bold text-emerald">{result.created}</p>
                    <p className="text-xs text-grey">{t("created")}</p>
                  </div>
                  <div className="rounded-md bg-panel p-2">
                    <p className="text-lg font-bold text-navy">{result.updated}</p>
                    <p className="text-xs text-grey">{t("updated")}</p>
                  </div>
                  <div className="rounded-md bg-panel p-2">
                    <p className="text-lg font-bold text-warning">{result.skipped}</p>
                    <p className="text-xs text-grey">{t("skipped")}</p>
                  </div>
                </div>
                {result.errors.length > 0 && (
                  <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto rounded-md bg-danger/5 p-2 text-xs text-danger">
                    {result.errors.slice(0, 50).map((er, i) => (
                      <li key={i}>{er}</li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}
            <div className="mt-5 flex justify-end">
              <button
                className="btn-primary"
                onClick={() => {
                  setResult(null);
                  setError(null);
                }}
              >
                {tc("close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
