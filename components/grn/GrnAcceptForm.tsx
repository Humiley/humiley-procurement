"use client";

import { useState, useTransition } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { acceptGrn } from "@/app/(portal)/goods-receipts/actions";
import { act } from "@/lib/act";

export type GrnQcLine = { grnLineId: string; description: string; received: string; lotTracked?: boolean };

/** §9 QC + acceptance — accepted/rejected split per line, signed as RECEIVED (§19). */
export function GrnAcceptForm({ grnId, grnNumber, lines }: { grnId: string; grnNumber: string; lines: GrnQcLine[] }) {
  const t = useTranslations("grn");
  const fmtErr = useActionError();
  const router = useRouter();
  const [qc, setQc] = useState<Record<string, { a: string; r: string; reason: string; lot: string; exp: string }>>(
    Object.fromEntries(lines.map((l) => [l.grnLineId, { a: l.received, r: "0", reason: "", lot: "", exp: "" }])),
  );
  const [signOpen, setSignOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  // Validate BEFORE the e-sign ceremony so a bad quantity never throws a signature away:
  // accepted + rejected must equal received, and a rejection needs a reason.
  function validateQc(): string | null {
    for (const l of lines) {
      const q = qc[l.grnLineId];
      const a = Number(q.a || "0");
      const r = Number(q.r || "0");
      const rec = Number(l.received);
      if (!Number.isFinite(a) || !Number.isFinite(r) || a < 0 || r < 0 || Math.abs(a + r - rec) > 1e-9) {
        return t("qcTitle");
      }
      if (r > 0 && !q.reason.trim()) return t("reasonPh");
    }
    return null;
  }

  async function onSign(payload: SignaturePayload) {
    act(await acceptGrn({
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
      imageData: payload.imageData,
    }));
    setSignOpen(false);
    start(() => router.refresh());
  }

  const field = "field w-full";
  return (
    <div className="rounded-xl border border-navy/20 bg-navy/5 p-4">
      <h3 className="mb-2 text-sm font-bold text-navy">{t("qcTitle")}</h3>
      {error ? <p className="mb-2 rounded bg-danger/10 px-2 py-1 text-xs text-danger">{error}</p> : null}
      <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
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
            <tr key={l.grnLineId} className="border-t border-line">
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
      </div>
      <div className="mt-3 flex justify-end">
        <button type="button" className="btn-emerald" onClick={() => { const v = validateQc(); setError(v); if (!v) setSignOpen(true); }}>
          {t("acceptSign")}
        </button>
      </div>
      <SignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onConfirm={async (p) => { try { await onSign(p); } catch (e) { setError(fmtErr(e)); setSignOpen(false); } }}
        title={`${t("signTitle")} — ${grnNumber}`}
        meanings={["RECEIVED"]}
        meaningLabel={() => t("meaningReceived")}
        submitLabel={t("signSubmit")}
        requireReason={false}
      />
    </div>
  );
}
