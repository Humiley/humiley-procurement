"use client";

import { useEffect, useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useTranslations } from "next-intl";
import { Search, Calculator, Loader2 } from "lucide-react";
import { searchTrade, estimateLanded, type TradeHit, type EstimateResult } from "@/app/(portal)/trade/estimator/actions";
import { act } from "@/lib/act";

/** §20 landed-cost estimator — search an item/HS code, enter commercials, compare duty routes. */
export function Estimator({ rates }: { rates: Record<string, number> }) {
  const t = useTranslations("estimator");
  const fmtErr = useActionError();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<TradeHit[]>([]);
  const [picked, setPicked] = useState<TradeHit | null>(null);
  const [unitPrice, setUnitPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [fx, setFx] = useState(String(rates.USD ?? 1));
  const [qty, setQty] = useState("1");
  const [freight, setFreight] = useState("0");
  const [handling, setHandling] = useState("0");
  const [origin, setOrigin] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EstimateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const h = setTimeout(async () => {
      if (q.trim().length < 2) return setHits([]);
      setHits(act(await searchTrade(q)));
    }, 250);
    return () => clearTimeout(h);
  }, [q]);

  useEffect(() => {
    const r = rates[currency.toUpperCase()];
    if (r) setFx(String(r));
  }, [currency, rates]);

  async function run() {
    if (!picked) return;
    setError(null);
    setBusy(true);
    try {
      setResult(
        act(await estimateLanded({
          hsCodeId: picked.hsCodeId,
          itemId: picked.itemId,
          unitPrice,
          currency,
          fxRate: fx,
          qty,
          freightEstVnd: freight || "0",
          handlingEstVnd: handling || "0",
          originCountry: origin || null,
        })),
      );
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  const fmt = (n: number) => n.toLocaleString("en-US");
  const field = "field w-full";
  return (
    <div className="space-y-4">
      <h1 className="page-title flex items-center gap-2"><Calculator className="h-5 w-5" /> {t("title")}</h1>
      <p className="text-sm text-grey">{t("subtitle")}</p>

      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3">
          <Search className="h-4 w-4 text-grey" />
          <input
            className="w-full border-0 py-2.5 text-sm outline-none"
            placeholder={t("searchPh")}
            value={picked ? picked.label : q}
            onChange={(e) => { setPicked(null); setResult(null); setQ(e.target.value); }}
          />
        </div>
        {!picked && hits.length > 0 ? (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden card shadow-lg">
            {hits.map((h) => (
              <li key={h.hsCodeId + (h.itemId ?? "")}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-navy/5"
                  onClick={() => {
                    setPicked(h);
                    setHits([]);
                    if (h.origin) setOrigin(h.origin);
                    if (h.lastPriceVnd) { setCurrency("VND"); setFx("1"); setUnitPrice(String(Math.round(Number(h.lastPriceVnd)))); }
                  }}
                >
                  <span>{h.label}</span>
                  <span className="text-sm font-semibold text-navy tabular-nums whitespace-nowrap">HS {h.hsCode}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {picked ? (
        <>
          <div className="grid grid-cols-2 gap-3 card p-4 sm:grid-cols-3 lg:grid-cols-6">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-grey">{t("unitPrice")} *</span>
              <input className={`${field} text-right`} value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="0" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-grey">{t("currency")}</span>
              <select className={field} value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {Object.keys(rates).map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-grey">{t("fx")}</span>
              <input className={`${field} text-right`} value={fx} onChange={(e) => setFx(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-grey">{t("qty")}</span>
              <input className={`${field} text-right`} value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-grey">{t("freight")}</span>
              <input className={`${field} text-right`} value={freight} onChange={(e) => setFreight(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-grey">{t("handling")}</span>
              <input className={`${field} text-right`} value={handling} onChange={(e) => setHandling(e.target.value)} />
            </label>
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-grey">{t("origin")}</span>
              <input className={field} value={origin} onChange={(e) => setOrigin(e.target.value.toUpperCase())} placeholder="CN / KR / DE…" maxLength={2} />
            </label>
            <div className="flex items-end sm:col-span-2">
              <button type="button" disabled={busy || !unitPrice} onClick={run} className="btn-primary w-full">
                {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : t("estimate")}
              </button>
            </div>
          </div>
          {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        </>
      ) : null}

      {result ? (
        <div className="space-y-3">
          <div className="card p-4 text-sm">
            <span className="font-semibold text-navy tabular-nums whitespace-nowrap">HS {result.hs.code}</span> — {result.hs.descriptionEn}
            {result.hs.notes ? <p className="mt-1 rounded-lg bg-warning/10 px-3 py-1.5 text-xs text-body"><b className="text-warning">{t("note")}:</b> {result.hs.notes}</p> : null}
          </div>
          <div className="overflow-x-auto card">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="th">
                  <th className="px-3 py-2.5">{t("route")}</th>
                  <th className="px-3 py-2.5 text-right">{t("duty")}</th>
                  <th className="px-3 py-2.5 text-right">{t("dutyAmt")}</th>
                  <th className="px-3 py-2.5 text-right">{t("importVat")}</th>
                  <th className="px-3 py-2.5 text-right">{t("landedUnit")}</th>
                </tr>
              </thead>
              <tbody>
                {result.routes.map((r) => {
                  const impossible = origin && r.countries.length > 0 && !r.countries.includes(origin);
                  return (
                    <tr key={r.routeKey} className={`border-b border-line last:border-0 ${impossible ? "opacity-40" : ""} ${r.cheapest && !impossible ? "bg-emerald/5" : ""}`}>
                      <td className="px-3 py-2.5">
                        <span className="font-semibold">{r.routeLabel}</span>
                        {r.countries.length ? <span className="ml-2 text-xs text-grey">{r.countries.join(", ")}</span> : null}
                        {r.cheapest && !impossible ? <span className="ml-2 rounded bg-emerald/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald">{t("cheapest")}</span> : null}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{r.dutyPct}%</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{fmt(r.dutyVnd)} ₫</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-grey">{fmt(r.importVatVnd)} ₫</td>
                      <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${r.cheapest && !impossible ? "text-emerald" : "text-navy"}`}>{fmt(r.landedUnitCostVnd)} ₫</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-grey">{t("vatFootnote")}</p>
        </div>
      ) : null}
    </div>
  );
}
