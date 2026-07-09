"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { createContract } from "@/app/(portal)/contracts/actions";
import { act } from "@/lib/act";
import { useUnsavedGuard } from "@/lib/use-unsaved";

export type CtrOpt = { id: string; label: string };

type PriceRow = { itemId: string; priceVnd: string };

/** §9 framework agreement form — vendor, validity, value, optional contracted price list. */
export function ContractForm({ vendors, items }: { vendors: CtrOpt[]; items: CtrOpt[] }) {
  const t = useTranslations("contracts");
  const fmtErr = useActionError();
  const router = useRouter();
  const [vendorId, setVendorId] = useState(vendors[0]?.id || "");
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [valueVnd, setValueVnd] = useState("");
  const [alertDays, setAlertDays] = useState("60");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useUnsavedGuard(touched);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = act(await createContract({
        vendorId,
        title,
        startDate,
        endDate,
        valueVnd: valueVnd.replace(/[,.\s]/g, ""),
        renewalAlertDays: alertDays,
        prices: prices.filter((p) => p.itemId && p.priceVnd).map((p) => ({ itemId: p.itemId, priceVnd: p.priceVnd.replace(/[,.\s]/g, "") })),
      }));
      setTouched(false);
      router.push(`/contracts/${res.id}`);
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  const field = "field w-full";
  return (
    <div className="space-y-4" onChange={() => setTouched(true)}>
      <h1 className="text-lg font-bold text-navy">{t("newTitle")}</h1>
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-grey/20 bg-white p-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("vendor")} *</span>
          <select className={field} value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("title")} *</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePh")} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("startDate")} *</span>
          <input type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("endDate")} *</span>
          <input type="date" className={field} min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("value")} *</span>
          <input className={`${field} text-right`} placeholder="0" value={valueVnd} onChange={(e) => setValueVnd(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("alertDays")}</span>
          <input className={`${field} text-right`} value={alertDays} onChange={(e) => setAlertDays(e.target.value)} />
        </label>
      </div>

      <div className="rounded-xl border border-grey/20 bg-white p-4">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("priceList")}</h3>
        <p className="mb-3 text-xs text-grey">{t("priceListHint")}</p>
        {prices.map((p, i) => (
          <div key={i} className="mb-2 flex items-center gap-2">
            <select className={field} value={p.itemId} onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
              <option value="">—</option>
              {items.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </select>
            <input className="field w-44 text-right" placeholder={t("pricePh")} value={p.priceVnd} onChange={(e) => setPrices(prices.map((x, j) => (j === i ? { ...x, priceVnd: e.target.value } : x)))} />
            <button type="button" className="text-grey hover:text-danger" onClick={() => setPrices(prices.filter((_, j) => j !== i))} aria-label={t("removeLine")}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button type="button" className="btn-outline flex items-center gap-1.5" onClick={() => setPrices([...prices, { itemId: items[0]?.id || "", priceVnd: "" }])}>
          <Plus className="h-4 w-4" /> {t("addPrice")}
        </button>
      </div>

      <div className="flex justify-end">
        <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "…" : t("create")}
        </button>
      </div>
    </div>
  );
}
