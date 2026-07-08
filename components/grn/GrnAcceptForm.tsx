"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { acceptGrn } from "@/app/(portal)/goods-receipts/actions";

export type GrnQcLine = { grnLineId: string; description: string; received: string; lotTracked?: boolean };

/** §9 QC + acceptance — accepted/rejected split per line, signed as RECEIVED (§19). */
export function GrnAcceptForm({ grnId, grnNumber, lines }: { grnId: string; grnNumber: string; lines: GrnQcLine[] }) {
  const t = useTranslations("grn");
  const router = useRouter();
  const [qc, setQc] = useState<Record<string, { a: string; r: string; reason: string; lot: string; exp: string }>>(
    Object.fromEntries(lines.map((l) => [l.grnLineId, { a: l.received, r: "0", reason: "", lot: "", exp: "" }])),
  );
  const [signOpen, setSignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function onSign(payload: SignaturePayload) {
    await acceptGrn({
      payload: {
        grnId,
        lines: lines.map((l) => ({
          grnLineId: l.grnLineId,
          qtyAccepted: qc[l.grnLineId].a || "0",
          qtyRejected: qc[l.grnLineId].r || "0",
          rejectReason: qc[l.grnLineId].reason || null,
          lotNumber: l.lotTracked ? qc[l.grnLineId].lot || null : null,
          expiryDate: l.lotTracked ? qc[l.grnLineId].exp || null : null,
        })),
      },
      password: payload.password,
    });
    setSignOpen(false);
    start(() => router.refresh());
  }

  const field = "field w-full";
  return (
    <div className="rounded-xl border border-navy/20 bg-navy/5 p-4">
      <h3 className="mb-2 text-sm font-bold text-navy">{t("qcTitle")}</h3>
      {error ? <p className="mb-2 rounded bg-danger/10 px-2 py-1 text-xs text-danger">{error}</p> : null}
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-grey">
            <th className="py-1 pr-2">{t("lineDesc")}</th>
            <th className="w-24 py-1 pr-2 text-right">{t("received")}</th>
            <th className="w-28 py-1 pr-2">{t("accepted")}</th>
            <th className="w-28 py-1 pr-2">{t("rejected")}</th>
            <th className="py-1">{t("rejectReason")}</th>
            <th className="w-32 py-1 pl-2">{t("lot")}</th>
            <th className="w-36 py-1 pl-2">{t("expiry")}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <tr key={l.grnLineId} className="border-t border-grey/10">
              <td className="max-w-[240px] truncate py-1.5 pr-2">{l.description}</td>
              <td className="py-1.5 pr-2 text-right tabular-nums">{l.received}</td>
              <td className="py-1 pr-2"><input className={`${field} text-right`} value={qc[l.grnLineId].a} onChange={(e) => setQc({ ...qc, [l.grnLineId]: { ...qc[l.grnLineId], a: e.target.value } })} /></td>
              <td className="py-1 pr-2"><input className={`${field} text-right`} value={qc[l.grnLineId].r} onChange={(e) => setQc({ ...qc, [l.grnLineId]: { ...qc[l.grnLineId], r: e.target.value } })} /></td>
              <td className="py-1"><input className={field} placeholder={t("reasonPh")} value={qc[l.grnLineId].reason} onChange={(e) => setQc({ ...qc, [l.grnLineId]: { ...qc[l.grnLineId], reason: e.target.value } })} /></td>
              <td className="py-1 pl-2">{l.lotTracked ? <input className={field} placeholder={t("lotAutoPh")} value={qc[l.grnLineId].lot} onChange={(e) => setQc({ ...qc, [l.grnLineId]: { ...qc[l.grnLineId], lot: e.target.value } })} /> : <span className="text-xs text-grey">—</span>}</td>
              <td className="py-1 pl-2">{l.lotTracked ? <input type="date" className={field} value={qc[l.grnLineId].exp} onChange={(e) => setQc({ ...qc, [l.grnLineId]: { ...qc[l.grnLineId], exp: e.target.value } })} /> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex justify-end">
        <button type="button" className="rounded-lg bg-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90" onClick={() => { setError(null); setSignOpen(true); }}>
          {t("acceptSign")}
        </button>
      </div>
      <SignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onConfirm={async (p) => { try { await onSign(p); } catch (e) { setError(e instanceof Error ? e.message : "Failed"); setSignOpen(false); } }}
        title={`${t("signTitle")} — ${grnNumber}`}
        meanings={["RECEIVED"]}
        meaningLabel={() => t("meaningReceived")}
        submitLabel={t("signSubmit")}
        requireReason={false}
      />
    </div>
  );
}
