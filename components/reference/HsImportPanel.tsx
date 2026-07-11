"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Upload, X, FileDown, CheckCircle2, AlertTriangle } from "lucide-react";
import { importHsCodes, type HsImportResult } from "@/app/(portal)/reference/hs-codes/actions";

/** Admin/Purchasing CSV import of the official HS tariff. Upsert by code — safe to re-run. */
export function HsImportPanel() {
  const t = useTranslations("hs");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<HsImportResult | null>(null);
  const [pending, start] = useTransition();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setCsv(await f.text());
    setResult(null);
  }

  function submit() {
    setResult(null);
    start(async () => {
      const r = await importHsCodes(csv);
      setResult(r);
      if (r.ok) router.refresh();
    });
  }

  function downloadTemplate() {
    const csvTpl =
      "code,descriptionEn,descriptionVn,category,keywords,uom,mfn,vat\r\n" +
      '8415.83,"Air conditioning machines, AHU","Máy điều hòa không khí (AHU)",HVAC & Refrigeration,"AHU, air handling",unit,20,10\r\n' +
      '7318.15,"Screws and bolts, threaded","Vít và bu lông có ren",Fasteners,"bolt, screw",kg,,\r\n';
    const url = URL.createObjectURL(new Blob(["﻿" + csvTpl], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "hs-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <button type="button" className="btn-outline" onClick={() => setOpen(true)}>
        <Upload className="h-4 w-4" /> {t("importCsv")}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/30 p-4" onClick={() => !pending && setOpen(false)}>
          <div className="w-full max-w-lg rounded-card bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-body">{t("importTitle")}</h2>
                <p className="mt-0.5 text-[13px] text-grey">{t("importSubtitle")}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-grey hover:text-navy" aria-label={t("close")}>
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div className="rounded-lg bg-panel p-3 text-xs text-grey">
                <p className="font-semibold text-body">{t("importColumns")}</p>
                <p className="mt-1"><code className="tabular-nums">code, descriptionEn, descriptionVn, category, keywords, uom, mfn, vat</code></p>
                <p className="mt-2">{t("importNote")}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label className="btn-outline cursor-pointer">
                  <Upload className="h-4 w-4" /> {t("chooseFile")}
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
                </label>
                <button type="button" className="btn-ghost" onClick={downloadTemplate}>
                  <FileDown className="h-4 w-4" /> {t("downloadTemplate")}
                </button>
                {fileName ? <span className="text-[13px] text-grey">{fileName}</span> : null}
              </div>

              {result ? (
                <div className={`flex items-start gap-2 rounded-lg p-3 text-[13px] ${result.ok ? "bg-emerald/10 text-emerald" : "bg-warning/10 text-warning"}`}>
                  {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none" /> : <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />}
                  <div>
                    <p className="font-semibold">
                      {result.code === "done"
                        ? t("importResultDone", { total: result.created + result.updated, created: result.created, updated: result.updated, skipped: result.skipped })
                        : t(`importResult_${result.code}`)}
                    </p>
                    {result.errors.length ? (
                      <ul className="mt-1 list-inside list-disc text-body/70">
                        {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                      </ul>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>{t("close")}</button>
              <button type="button" className="btn-primary" onClick={submit} disabled={pending || !csv}>
                {pending ? t("importing") : t("importButton")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
