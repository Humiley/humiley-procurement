"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileCheck2, FilePlus2 } from "lucide-react";
import { SignatureDialog } from "@/components/shared/SignatureDialog";
import { generateShipmentDocs, receiveShipmentDoc, verifyShipmentDoc } from "@/app/(portal)/purchase-orders/shipment.actions";

export type ShipDocRow = { id: string; type: string; status: string; docNumber: string | null; issueDate: string | null; formCode: string | null };
export type CooOpt = { id: string; label: string };

/** §20 import-document checklist — generate, mark received, VERIFIED via §19 signature. */
export function ShipmentDocsPanel({ poId, docs, cooForms, canAct }: { poId: string; docs: ShipDocRow[]; cooForms: CooOpt[]; canAct: boolean }) {
  const t = useTranslations("shipdocs");
  const fmtErr = useActionError();
  const router = useRouter();
  const [cooId, setCooId] = useState(cooForms[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Record<string, { num: string; date: string }>>(
    Object.fromEntries(docs.map((d) => [d.id, { num: d.docNumber ?? "", date: d.issueDate ?? "" }])),
  );
  const [verifyId, setVerifyId] = useState<string | null>(null);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  if (docs.length === 0) {
    if (!canAct) return null;
    return (
      <div className="rounded-xl border border-grey/20 bg-white p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("title")}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <select className="field" value={cooId} onChange={(e) => setCooId(e.target.value)}>
            {cooForms.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={() => run(() => generateShipmentDocs({ poId, cooFormTypeId: cooId || null }))} className="flex items-center gap-1.5 rounded-lg bg-navy px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <FilePlus2 className="h-4 w-4" /> {t("generate")}
          </button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </div>
        <p className="mt-2 text-xs text-grey">{t("generateHint")}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-grey/20 bg-white p-4">
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("title")}</h3>
      {error ? <p className="mb-2 rounded bg-danger/10 px-2 py-1 text-xs text-danger">{error}</p> : null}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
            <th className="py-2">{t("doc")}</th>
            <th className="w-40 py-2">{t("number")}</th>
            <th className="w-36 py-2">{t("issueDate")}</th>
            <th className="w-28 py-2">{t("status")}</th>
            <th className="w-40 py-2 text-right" />
          </tr>
        </thead>
        <tbody>
          {docs.map((d) => (
            <tr key={d.id} className="border-t border-grey/10">
              <td className="py-2 font-semibold">
                {t(`type.${d.type}`)}
                {d.formCode ? <span className="ml-1.5 rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald">{d.formCode.replace("_", " ")}</span> : null}
              </td>
              <td className="py-1 pr-2">
                {d.status === "PENDING" && canAct ? (
                  <input className="field w-full" value={meta[d.id]?.num ?? ""} onChange={(e) => setMeta({ ...meta, [d.id]: { ...meta[d.id], num: e.target.value } })} />
                ) : (
                  <span className="font-mono text-xs">{d.docNumber || "—"}</span>
                )}
              </td>
              <td className="py-1 pr-2">
                {d.status === "PENDING" && canAct ? (
                  <input type="date" className="field w-full" value={meta[d.id]?.date ?? ""} onChange={(e) => setMeta({ ...meta, [d.id]: { ...meta[d.id], date: e.target.value } })} />
                ) : (
                  <span className="text-xs">{d.issueDate || "—"}</span>
                )}
              </td>
              <td className="py-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${d.status === "VERIFIED" ? "bg-emerald/10 text-emerald" : d.status === "RECEIVED" ? "bg-navy/10 text-navy" : "bg-grey/15 text-grey"}`}>
                  {t(`docStatus.${d.status}`)}
                </span>
              </td>
              <td className="py-1 text-right">
                {canAct && d.status === "PENDING" ? (
                  <button type="button" disabled={busy} onClick={() => run(() => receiveShipmentDoc({ docId: d.id, docNumber: meta[d.id]?.num || null, issueDate: meta[d.id]?.date || null }))} className="rounded-lg border border-navy/30 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/5">
                    {t("markReceived")}
                  </button>
                ) : null}
                {canAct && d.status === "RECEIVED" ? (
                  <button type="button" onClick={() => setVerifyId(d.id)} className="inline-flex items-center gap-1 rounded-lg bg-emerald px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90">
                    <FileCheck2 className="h-3.5 w-3.5" /> {t("verify")}
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <SignatureDialog
        open={verifyId !== null}
        onClose={() => setVerifyId(null)}
        title={t("signTitle")}
        meanings={["VERIFIED"]}
        meaningLabel={() => t("meaningVerified")}
        submitLabel={t("verify")}
        onConfirm={async (p) => {
          await verifyShipmentDoc({ docId: verifyId!, password: p.password });
          setVerifyId(null);
          router.refresh();
        }}
      />
    </div>
  );
}
