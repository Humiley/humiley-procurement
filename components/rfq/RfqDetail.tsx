"use client";

import { useState, useTransition } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send, Trophy } from "lucide-react";
import { sendRfq, enterQuote, awardQuote, closeRfq } from "@/app/(portal)/rfqs/actions";
import { act } from "@/lib/act";
import { toast } from "@/components/shared/Toaster";
import { TextPromptDialog } from "@/components/shared/TextPromptDialog";

export type RfqVendorCol = {
  vendorId: string;
  code: string;
  nameEn: string;
  sentAt: string | null;
  respondedAt: string | null;
  quote: {
    id: string;
    totalVnd: string; // plain number string for comparisons
    leadTimeDays: number | null;
    paymentTerms: string | null;
    validUntil: string | null;
    priceByLine: Record<string, string>; // rfqLineId -> unit price (plain number string)
  } | null;
};
export type RfqLineRow = { id: string; no: number; description: string; uom: string; qty: string; qtyNum: number };

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

/** §8 RFQ detail: send to vendors, enter quotes, comparison matrix (lowest per line emerald), award. */
export function RfqDetail({
  rfqId,
  status,
  estimateVnd,
  lines,
  vendors,
  canManage,
}: {
  rfqId: string;
  status: string;
  estimateVnd: number;
  lines: RfqLineRow[];
  vendors: RfqVendorCol[];
  canManage: boolean;
}) {
  const t = useTranslations("rfq");
  const tc = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [justFor, setJustFor] = useState<null | { kind: "send" } | { kind: "award"; v: RfqVendorCol }>(null);
  const [error, setError] = useState<string | null>(null);
  const [entryFor, setEntryFor] = useState<string | null>(null); // vendorId being quoted
  const [entry, setEntry] = useState<{ prices: Record<string, string>; lead: string; terms: string; valid: string; ref: string }>({ prices: {}, lead: "", terms: "", valid: "", ref: "" });
  const [, start] = useTransition();

  const quoted = vendors.filter((v) => v.quote);
  const lowestTotal = quoted.length ? Math.min(...quoted.map((v) => Number(v.quote!.totalVnd))) : null;
  const lowestByLine: Record<string, number> = {};
  for (const l of lines) {
    const prices = quoted.map((v) => Number(v.quote!.priceByLine[l.id] ?? Infinity)).filter((p) => isFinite(p));
    if (prices.length) lowestByLine[l.id] = Math.min(...prices);
  }

  async function run(kind: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(kind);
    try {
      act(await fn());
      toast(tc("done"));
      start(() => router.refresh());
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSend() {
    const needJust = estimateVnd > 100_000_000 && vendors.length < 3;
    if (needJust) return setJustFor({ kind: "send" });   // §15 justification via a real dialog, not window.prompt
    await run("send", () => sendRfq(rfqId, undefined));
  }

  async function doAward(v: RfqVendorCol, justification?: string) {
    setError(null);
    setBusy("award" + v.vendorId);
    try {
      const res = act(await awardQuote({ rfqId, quoteId: v.quote!.id, justification }));
      toast(tc("done"));
      router.push(`/purchase-orders/${res.poId}`);
    } catch (e) {
      setError(fmtErr(e));
      setBusy(null);
    }
  }

  async function onAward(v: RfqVendorCol) {
    // awarding creates a purchase order — never a single silent click
    if (!window.confirm(tc("confirmIrreversible"))) return;
    const notLowest = lowestTotal !== null && Number(v.quote!.totalVnd) > lowestTotal;
    if (notLowest) return setJustFor({ kind: "award", v });
    await doAward(v);
  }

  function openEntry(v: RfqVendorCol) {
    setEntryFor(v.vendorId);
    setEntry({
      prices: Object.fromEntries(lines.map((l) => [l.id, v.quote?.priceByLine[l.id] ?? ""])),
      lead: v.quote?.leadTimeDays != null ? String(v.quote.leadTimeDays) : "",
      terms: v.quote?.paymentTerms ?? "",
      valid: "",
      ref: "",
    });
  }

  async function saveEntry() {
    if (!entryFor) return;
    await run("entry", () =>
      enterQuote({
        rfqId,
        vendorId: entryFor,
        quoteRef: entry.ref || null,
        validUntil: entry.valid || null,
        leadTimeDays: entry.lead === "" ? null : Number(entry.lead),
        paymentTerms: entry.terms || null,
        lines: lines.map((l) => ({ rfqLineId: l.id, unitPrice: entry.prices[l.id] || "0" })),
      }),
    );
    setEntryFor(null);
  }

  const field = "field w-full";
  return (
    <div className="space-y-4">
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      {/* vendors + lifecycle */}
      <div className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-navy">{t("vendorsPanel")}</h2>
          <div className="flex gap-2">
            {canManage && status === "DRAFT" ? (
              <button className="btn-primary" disabled={!!busy} onClick={onSend}>
                <Send className="h-3.5 w-3.5" /> {busy === "send" ? "…" : t("send")}
              </button>
            ) : null}
            {canManage && ["DRAFT", "SENT"].includes(status) ? (
              <button className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-grey hover:bg-grey/10" disabled={!!busy} onClick={() => { if (!window.confirm(tc("confirmIrreversible"))) return; run("close", () => closeRfq(rfqId)); }}>
                {t("close")}
              </button>
            ) : null}
          </div>
        </div>
        <ul className="space-y-1.5">
          {vendors.map((v) => (
            <li key={v.vendorId} className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm">
              <span className="font-mono text-xs font-bold text-navy">{v.code}</span>
              <span className="min-w-0 flex-1 truncate">{v.nameEn}</span>
              {v.sentAt ? <span className="text-[11px] text-grey">{t("sentAt", { d: v.sentAt })}</span> : <span className="text-[11px] text-grey">{t("notSent")}</span>}
              {v.respondedAt ? <span className="rounded bg-emerald/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald">{t("responded")}</span> : null}
              <a href={`/api/rfq/${rfqId}/pdf?vendor=${v.vendorId}`} target="_blank" rel="noopener" className="rounded border border-navy/30 px-2 py-0.5 text-[11px] font-semibold text-navy hover:bg-navy/5">PDF</a>
              {canManage && status === "SENT" ? (
                <button className="rounded-lg bg-navy/10 px-2.5 py-1 text-xs font-semibold text-navy hover:bg-navy/20" onClick={() => openEntry(v)}>
                  {v.quote ? t("editQuote") : t("enterQuote")}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {/* quote entry */}
      {entryFor ? (
        <div className="rounded-xl border border-navy/30 bg-navy/5 p-4">
          <h3 className="mb-2 text-sm font-bold text-navy">
            {t("entryTitle", { vendor: vendors.find((v) => v.vendorId === entryFor)?.nameEn ?? "" })}
          </h3>
          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <label className="text-xs"><span className="mb-0.5 block font-semibold text-grey">{t("quoteRef")}</span><input className={field} value={entry.ref} onChange={(e) => setEntry({ ...entry, ref: e.target.value })} /></label>
            <label className="text-xs"><span className="mb-0.5 block font-semibold text-grey">{t("leadDays")}</span><input className={field} value={entry.lead} onChange={(e) => setEntry({ ...entry, lead: e.target.value })} /></label>
            <label className="text-xs"><span className="mb-0.5 block font-semibold text-grey">{t("terms")}</span><input className={field} value={entry.terms} onChange={(e) => setEntry({ ...entry, terms: e.target.value })} /></label>
            <label className="text-xs"><span className="mb-0.5 block font-semibold text-grey">{t("validUntil")}</span><input type="date" className={field} value={entry.valid} onChange={(e) => setEntry({ ...entry, valid: e.target.value })} /></label>
          </div>
          <table className="w-full text-sm">
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="py-1 pr-2 text-xs text-grey">#{l.no}</td>
                  <td className="max-w-[280px] truncate py-1 pr-2">{l.description}</td>
                  <td className="py-1 pr-2 text-right text-xs text-grey">{l.qty} {l.uom}</td>
                  <td className="w-40 py-1">
                    <input className={`${field} text-right`} placeholder={t("unitPrice")} value={entry.prices[l.id] ?? ""} onChange={(e) => setEntry({ ...entry, prices: { ...entry.prices, [l.id]: e.target.value } })} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-end gap-2">
            <button className="rounded-lg border border-line px-3 py-1.5 text-sm text-grey" onClick={() => setEntryFor(null)}>{t("cancel")}</button>
            <button className="btn-primary" disabled={busy === "entry"} onClick={saveEntry}>{busy === "entry" ? "…" : t("saveQuote")}</button>
          </div>
        </div>
      ) : null}

      {/* comparison matrix */}
      {quoted.length > 0 ? (
        <div className="overflow-x-auto card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2.5">{t("compareLine")}</th>
                {quoted.map((v) => (
                  <th key={v.vendorId} className="px-3 py-2.5 text-right">{v.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b border-line">
                  <td className="max-w-[280px] truncate px-3 py-2" title={l.description}>#{l.no} {l.description} <span className="text-xs text-grey">× {l.qty}</span></td>
                  {quoted.map((v) => {
                    const p = Number(v.quote!.priceByLine[l.id] ?? NaN);
                    const isLow = isFinite(p) && lowestByLine[l.id] === p;
                    return (
                      <td key={v.vendorId} className={`px-3 py-2 text-right tabular-nums ${isLow ? "bg-emerald/10 font-bold text-emerald" : ""}`}>
                        {isFinite(p) ? fmt(p) : "—"}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b border-line bg-panel font-bold">
                <td className="px-3 py-2">{t("compareTotal")}</td>
                {quoted.map((v) => {
                  const tot = Number(v.quote!.totalVnd);
                  const isLow = lowestTotal === tot;
                  return <td key={v.vendorId} className={`px-3 py-2 text-right tabular-nums ${isLow ? "bg-emerald/15 text-emerald" : "text-navy"}`}>{fmt(tot)} ₫</td>;
                })}
              </tr>
              <tr className="border-b border-line">
                <td className="px-3 py-2 text-xs text-grey">{t("compareLead")}</td>
                {quoted.map((v) => <td key={v.vendorId} className="px-3 py-2 text-right text-xs">{v.quote!.leadTimeDays != null ? `${v.quote!.leadTimeDays}d` : "—"}</td>)}
              </tr>
              <tr className="border-b border-line">
                <td className="px-3 py-2 text-xs text-grey">{t("compareTerms")}</td>
                {quoted.map((v) => <td key={v.vendorId} className="max-w-[140px] truncate px-3 py-2 text-right text-xs" title={v.quote!.paymentTerms ?? ""}>{v.quote!.paymentTerms || "—"}</td>)}
              </tr>
              {canManage && status === "SENT" ? (
                <tr>
                  <td className="px-3 py-2.5" />
                  {quoted.map((v) => (
                    <td key={v.vendorId} className="px-3 py-2.5 text-right">
                      <button
                        className="btn-emerald btn-sm"
                        disabled={!!busy}
                        onClick={() => onAward(v)}
                      >
                        <Trophy className="h-3 w-3" /> {busy === "award" + v.vendorId ? "…" : t("award")}
                      </button>
                    </td>
                  ))}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="card p-4 text-sm text-grey">{t("noQuotesYet")}</p>
      )}
      <TextPromptDialog
        open={!!justFor}
        title={justFor?.kind === "award" ? t("awardJustification") : t("sendJustification")}
        label={justFor?.kind === "award" ? t("awardJustification") : t("sendJustification")}
        onClose={() => setJustFor(null)}
        onConfirm={async (just) => {
          const j = justFor;
          setJustFor(null);
          if (j?.kind === "send") await run("send", () => sendRfq(rfqId, just));
          else if (j?.kind === "award") await doAward(j.v, just);
        }}
      />
    </div>
  );
}
