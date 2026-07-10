"use client";

import { useMemo, useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPaymentRequest } from "@/app/(portal)/payment-requests/actions";
import { PAYREQ_TYPES } from "@/lib/schemas/payreq";
import { act } from "@/lib/act";
import { useUnsavedGuard } from "@/lib/use-unsaved";

/** Local (client) yyyy-mm-dd — do not use toISOString(): it shifts across the UTC boundary. */
function todayLocalIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export type PayReqOpt = { id: string; label: string };
export type PayReqInvoice = { id: string; vendorId: string; label: string; amount: number };

/** §10a create form — the four types with type-specific sourcing. */
export function PayReqForm({
  canVendorPayment,
  costCenters,
  vendors,
  invoices,
  openPos,
  myPaidAdvances,
}: {
  canVendorPayment: boolean;
  costCenters: PayReqOpt[];
  vendors: PayReqOpt[];
  invoices: PayReqInvoice[];
  openPos: PayReqOpt[];
  myPaidAdvances: PayReqOpt[];
}) {
  const t = useTranslations("payreq");
  const fmtErr = useActionError();
  const router = useRouter();
  const types = PAYREQ_TYPES.filter((x) => x !== "VENDOR_PAYMENT" || canVendorPayment);
  const [type, setType] = useState<string>(types[0]);
  const [costCenterId, setCostCenterId] = useState(costCenters[0]?.id || "");
  const [vendorId, setVendorId] = useState("");
  const [invoiceIds, setInvoiceIds] = useState<Set<string>>(new Set());
  const [poId, setPoId] = useState("");
  const [advanceRequestId, setAdvanceRequestId] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [lines, setLines] = useState<{ description: string; amount: string }[]>([{ description: "", amount: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useUnsavedGuard(touched);

  const vendorInvoices = useMemo(() => invoices.filter((i) => i.vendorId === vendorId), [invoices, vendorId]);
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  const total = useMemo(() => {
    if (type === "VENDOR_PAYMENT") return vendorInvoices.filter((i) => invoiceIds.has(i.id)).reduce((s, i) => s + i.amount, 0);
    if (type === "ADVANCE") return Number(amount) || 0;
    return lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);
  }, [type, vendorInvoices, invoiceIds, amount, lines]);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = act(await createPaymentRequest({
        type: type as never,
        costCenterId,
        vendorId: vendorId || null,
        invoiceIds: Array.from(invoiceIds),
        poId: poId || null,
        advanceRequestId: advanceRequestId || null,
        amount: amount || undefined,
        dueDate: dueDate || null,
        reason,
        paymentMethod: method as never,
        lines: lines.filter((l) => l.description && Number(l.amount) > 0),
      }));
      setTouched(false);
      router.push(`/payment-requests/${res.id}`);
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  const field = "field w-full";
  return (
    <div className="space-y-4" onChange={() => setTouched(true)}>
      <h1 className="page-title">{t("newTitle")}</h1>
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {types.map((x) => (
          <button key={x} type="button" onClick={() => setType(x)}
            className={`rounded-lg border px-3 py-1.5 text-sm ${type === x ? "border-navy bg-navy/10 font-semibold text-navy" : "border-line text-grey hover:bg-grey/5"}`}>
            {t(`type.${x}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 card p-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("costCenter")} *</span>
          <select className={field} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
            {costCenters.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("method")}</span>
          <select className={field} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="BANK_TRANSFER">{t("bankTransfer")}</option>
            <option value="CASH">{t("cash")}</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("dueDate")}</span>
          <input type="date" className={field} min={todayLocalIso()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-3">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("reason")} *</span>
          <input className={field} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPh")} />
        </label>
      </div>

      {type === "VENDOR_PAYMENT" ? (
        <div className="card p-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-grey">{t("vendor")} *</span>
            <select className={field} value={vendorId} onChange={(e) => { setVendorId(e.target.value); setInvoiceIds(new Set()); }}>
              <option value="">—</option>
              {vendors.map((v) => (<option key={v.id} value={v.id}>{v.label}</option>))}
            </select>
          </label>
          {vendorId ? (
            vendorInvoices.length ? (
              <ul className="mt-3 space-y-1.5">
                {vendorInvoices.map((i) => (
                  <li key={i.id}>
                    <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${invoiceIds.has(i.id) ? "border-navy bg-navy/5" : "border-line"}`}>
                      <input type="checkbox" checked={invoiceIds.has(i.id)} onChange={() => setInvoiceIds((s) => { const n = new Set(s); if (n.has(i.id)) n.delete(i.id); else n.add(i.id); return n; })} />
                      <span className="min-w-0 flex-1 truncate">{i.label}</span>
                      <b className="text-navy">{fmt(i.amount)} ₫</b>
                    </label>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-grey">{t("noMatchedInvoices")}</p>
            )
          ) : null}
        </div>
      ) : null}

      {type === "ADVANCE" ? (
        <div className="grid grid-cols-1 gap-3 card p-4 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-grey">{t("amount")} *</span>
            <input className={`${field} text-right`} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-grey">{t("advancePo")}</span>
            <select className={field} value={poId} onChange={(e) => setPoId(e.target.value)}>
              <option value="">{t("noPo")}</option>
              {openPos.map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
            </select>
          </label>
        </div>
      ) : null}

      {type === "ADVANCE_SETTLEMENT" ? (
        <div className="card p-4">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-semibold text-grey">{t("settleAdvance")} *</span>
            <select className={field} value={advanceRequestId} onChange={(e) => setAdvanceRequestId(e.target.value)}>
              <option value="">—</option>
              {myPaidAdvances.map((a) => (<option key={a.id} value={a.id}>{a.label}</option>))}
            </select>
          </label>
        </div>
      ) : null}

      {type === "REIMBURSEMENT" || type === "ADVANCE_SETTLEMENT" ? (
        <div className="card p-4">
          <span className="mb-2 block text-xs font-semibold text-grey">{t("expenseLines")} *</span>
          {lines.map((l, i) => (
            <div key={i} className="mb-1.5 flex gap-2">
              <input className={`${field} flex-1`} placeholder={t("lineDesc")} value={l.description} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} />
              <input className={`${field} w-40 text-right`} placeholder="0" value={l.amount} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
              <button type="button" className="text-danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-grey hover:bg-grey/10" onClick={() => setLines((ls) => [...ls, { description: "", amount: "" }])}>
            {t("addLine")}
          </button>
          {type === "REIMBURSEMENT" ? <p className="mt-2 text-xs text-warning">{t("receiptsNote")}</p> : null}
        </div>
      ) : null}

      <div className="flex items-center justify-end gap-4">
        <span className="text-sm text-grey">{t("total")}: <b className="text-base text-navy">{fmt(total)} ₫</b></span>
        <button type="button" disabled={busy} onClick={submit} className="btn-primary">
          {busy ? "…" : t("create")}
        </button>
      </div>
    </div>
  );
}
