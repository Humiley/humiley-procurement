"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createInvoice } from "@/app/(portal)/invoices/actions";

export type InvPoOpt = { id: string; label: string };
export type InvPoLine = { poLineId: string; description: string; uom: string; poPrice: string; toInvoice: string };

/** §9 invoice entry — lines default from received-not-yet-invoiced quantities at PO prices. */
export function InvoiceForm({
  pos,
  selectedPoId,
  lines,
}: {
  pos: InvPoOpt[];
  selectedPoId?: string | null;
  lines: InvPoLine[];
}) {
  const t = useTranslations("invoice");
  const router = useRouter();
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<Record<string, { qty: string; price: string }>>(
    Object.fromEntries(lines.map((l) => [l.poLineId, { qty: l.toInvoice, price: l.poPrice }])),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await createInvoice({
        poId: selectedPoId!,
        vendorInvoiceNo,
        invoiceDate,
        lines: lines.map((l) => ({ poLineId: l.poLineId, qty: rows[l.poLineId]?.qty || "0", unitPrice: rows[l.poLineId]?.price || "0" })),
      });
      router.push(`/invoices/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the invoice.");
      setBusy(false);
    }
  }

  const field = "field w-full";
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-navy">{t("newTitle")}</h1>
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-grey/20 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("po")} *</span>
          <select className={field} value={selectedPoId || ""} onChange={(e) => router.push(`/invoices/new?po=${e.target.value}`)}>
            <option value="">—</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("vendorInvoiceNo")} *</span>
          <input className={field} value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} placeholder="e.g. 0001234/HD-2026" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("invoiceDate")} *</span>
          <input type="date" className={field} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
        </label>
      </div>

      {selectedPoId && lines.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                  <th className="px-3 py-2">{t("lineDesc")}</th>
                  <th className="w-20 px-3 py-2">{t("uom")}</th>
                  <th className="w-32 px-3 py-2 text-right">{t("toInvoice")}</th>
                  <th className="w-32 px-3 py-2 text-right">{t("qty")}</th>
                  <th className="w-40 px-3 py-2 text-right">{t("unitPrice")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.poLineId} className="border-b border-grey/10 last:border-0">
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2">{l.uom}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-navy">{l.toInvoice}</td>
                    <td className="px-2 py-1.5"><input className={`${field} text-right`} value={rows[l.poLineId]?.qty ?? ""} onChange={(e) => setRows({ ...rows, [l.poLineId]: { ...rows[l.poLineId], qty: e.target.value } })} /></td>
                    <td className="px-2 py-1.5"><input className={`${field} text-right`} value={rows[l.poLineId]?.price ?? ""} onChange={(e) => setRows({ ...rows, [l.poLineId]: { ...rows[l.poLineId], price: e.target.value } })} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end">
            <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
              {busy ? "…" : t("create")}
            </button>
          </div>
        </>
      ) : selectedPoId ? (
        <p className="rounded-xl border border-grey/20 bg-white p-4 text-sm text-grey">{t("nothingToInvoice")}</p>
      ) : (
        <p className="rounded-xl border border-grey/20 bg-white p-4 text-sm text-grey">{t("pickPo")}</p>
      )}
    </div>
  );
}
