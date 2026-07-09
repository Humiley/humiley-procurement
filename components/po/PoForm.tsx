"use client";

import { useEffect, useMemo, useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createPo } from "@/app/(portal)/purchase-orders/actions";
import { INCOTERMS_2020, VAT_RATES } from "@/lib/schemas/po";
import { act } from "@/lib/act";
import { MoneyInput } from "@/components/shared/MoneyInput";
import { useUnsavedGuard } from "@/lib/use-unsaved";

/** Keep only digits and at most one decimal dot. */
function cleanQty(v: string): string {
  const s = v.replace(/[^\d.]/g, "");
  const i = s.indexOf(".");
  return i === -1 ? s : s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, "");
}

export type PoFormOpt = { id: string; label: string };
export type PoVendorContract = { contractNumber: string; prices: Record<string, string> };
export type PoFormLine = {
  prLineId?: string | null;
  itemId?: string | null;
  description: string;
  uomId: string;
  qty: string;
  unitPrice: string;
};

/** §8 PO create form — from an approved PR (lines prefilled) or standalone. */
export function PoForm({
  vendors,
  uoms,
  fromPr,
  initialLines,
  contracts = {},
}: {
  vendors: PoFormOpt[];
  uoms: PoFormOpt[];
  fromPr?: { id: string; label: string } | null;
  initialLines: PoFormLine[];
  contracts?: Record<string, PoVendorContract>;
}) {
  const t = useTranslations("po");
  const tc = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [vendorId, setVendorId] = useState("");
  const [currency, setCurrency] = useState("VND");
  const [fxRate, setFxRate] = useState("1");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [incoterm, setIncoterm] = useState("");
  const [incotermPlace, setIncotermPlace] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [warrantyTerms, setWarrantyTerms] = useState("");
  const [vatPct, setVatPct] = useState<string>("10");
  const [lines, setLines] = useState<PoFormLine[]>(
    initialLines.length ? initialLines : [{ description: "", uomId: uoms[0]?.id || "", qty: "1", unitPrice: "0" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useUnsavedGuard(touched);

  // §9: an ACTIVE framework agreement auto-fills contracted prices; edits are flagged inline.
  const activeContract = contracts[vendorId];
  useEffect(() => {
    if (!activeContract) return;
    setLines((ls) => ls.map((l) => (l.itemId && activeContract.prices[l.itemId] ? { ...l, unitPrice: activeContract.prices[l.itemId] } : l)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const totals = useMemo(() => {
    const sub = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.unitPrice) || 0), 0);
    const vat = (sub * (Number(vatPct) || 0)) / 100;
    return { sub, vat, total: sub + vat };
  }, [lines, vatPct]);
  const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  function setLine(i: number, patch: Partial<PoFormLine>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    if (!vendorId) {
      setError(tc("required"));
      return;
    }
    setBusy(true);
    try {
      const res = act(await createPo({
        vendorId,
        prId: fromPr?.id ?? null,
        currency,
        fxRate,
        paymentTerms,
        incoterm: (incoterm || null) as never,
        incotermPlace,
        deliveryAddress,
        expectedDate: expectedDate || null,
        warrantyTerms,
        vatPct: vatPct as never,
        lines: lines.map((l) => ({ ...l, qty: String(l.qty), unitPrice: String(l.unitPrice) })),
      }));
      setTouched(false);
      router.push(`/purchase-orders/${res.id}`);
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  const field = "field w-full";
  return (
    <div className="space-y-4" onChange={() => setTouched(true)}>
      <h1 className="text-lg font-bold text-navy">{t("newTitle")}</h1>
      {fromPr ? (
        <p className="rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy">{t("fromPr", { ref: fromPr.label })}</p>
      ) : null}
      {activeContract ? (
        <p className="rounded-lg bg-emerald/10 px-3 py-2 text-sm text-emerald">{t("contractApplied", { ref: activeContract.contractNumber })}</p>
      ) : null}
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-grey/20 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("vendor")} *</span>
          <select className={field} value={vendorId} required onChange={(e) => setVendorId(e.target.value)}>
            <option value="">—</option>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("currency")}</span>
          <input className={field} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase().slice(0, 3))} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("fxRate")}</span>
          <input className={field} value={fxRate} onChange={(e) => setFxRate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("paymentTerms")}</span>
          <input className={field} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder={t("paymentTermsPh")} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("incoterm")}</span>
          <select className={field} value={incoterm} onChange={(e) => setIncoterm(e.target.value)}>
            <option value="">—</option>
            {INCOTERMS_2020.map((i) => (
              <option key={i}>{i}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("incotermPlace")}</span>
          <input className={field} value={incotermPlace} onChange={(e) => setIncotermPlace(e.target.value)} placeholder="e.g. Cat Lai Port, HCMC" />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("deliveryAddress")}</span>
          <input className={field} value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("expectedDate")}</span>
          <input type="date" className={field} value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("warranty")}</span>
          <input className={field} value={warrantyTerms} onChange={(e) => setWarrantyTerms(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("vat")}</span>
          <select className={field} value={vatPct} onChange={(e) => setVatPct(e.target.value)}>
            {VAT_RATES.map((r) => (
              <option key={r} value={r}>{r}%</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              <th className="px-3 py-2">{t("lineDesc")}</th>
              <th className="w-32 px-3 py-2">{t("uom")}</th>
              <th className="w-28 px-3 py-2 text-right">{t("qty")}</th>
              <th className="w-36 px-3 py-2 text-right">{t("unitPrice")}</th>
              <th className="w-36 px-3 py-2 text-right">{t("amount")}</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-grey/10 last:border-0">
                <td className="px-2 py-1.5">
                  <input className={field} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} />
                </td>
                <td className="px-2 py-1.5">
                  <select className={field} value={l.uomId} onChange={(e) => setLine(i, { uomId: e.target.value })}>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input className={`${field} text-right tabular-nums`} inputMode="decimal" value={l.qty} onChange={(e) => setLine(i, { qty: cleanQty(e.target.value) })} />
                </td>
                <td className="px-2 py-1.5">
                  <MoneyInput value={l.unitPrice} onChange={(raw) => setLine(i, { unitPrice: raw })} />
                  {activeContract && l.itemId && activeContract.prices[l.itemId] ? (
                    <span className={`mt-0.5 block text-right text-[10px] font-semibold ${Number(l.unitPrice) === Number(activeContract.prices[l.itemId]) ? "text-emerald" : "text-danger"}`}>
                      {t("contractPrice")}: {Number(activeContract.prices[l.itemId]).toLocaleString("en-US")}
                    </span>
                  ) : null}
                </td>
                <td className="px-3 py-1.5 text-right font-medium">{fmt((Number(l.qty) || 0) * (Number(l.unitPrice) || 0))}</td>
                <td className="px-2 py-1.5">
                  <button type="button" className="text-danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between border-t border-grey/15 px-3 py-2">
          <button
            type="button"
            className="rounded-lg border border-grey/30 px-3 py-1 text-xs font-semibold text-grey hover:bg-grey/10"
            onClick={() => setLines((ls) => [...ls, { description: "", uomId: uoms[0]?.id || "", qty: "1", unitPrice: "0" }])}
          >
            {t("addLine")}
          </button>
          <div className="text-right text-sm">
            <div className="text-grey">{t("subtotal")}: <b>{fmt(totals.sub)} ₫</b></div>
            <div className="text-grey">VAT {vatPct}%: <b>{fmt(totals.vat)} ₫</b></div>
            <div className="text-navy">{t("total")}: <b className="text-base">{fmt(totals.total)} ₫</b></div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "…" : t("create")}
        </button>
      </div>
    </div>
  );
}
