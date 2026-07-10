"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { createTransfer } from "@/app/(portal)/inventory/transfers/actions";
import { act } from "@/lib/act";
import { useUnsavedGuard } from "@/lib/use-unsaved";

export type TrfOpt = { id: string; label: string };
export type TrfItemOpt = { id: string; label: string; uom: string };
export type TrfStockRow = { warehouseId: string; itemId: string; onHand: string };

type Line = { itemId: string; qty: string };

/** §10b transfer request — source/destination warehouses + item lines with source on-hand hints. */
export function TransferForm({ warehouses, items, stock }: { warehouses: TrfOpt[]; items: TrfItemOpt[]; stock: TrfStockRow[] }) {
  const t = useTranslations("trf");
  const fmtErr = useActionError();
  const router = useRouter();
  const [fromId, setFromId] = useState(warehouses[0]?.id || "");
  const [toId, setToId] = useState(warehouses[1]?.id || "");
  const [lines, setLines] = useState<Line[]>([{ itemId: items[0]?.id || "", qty: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  useUnsavedGuard(touched);

  const onHand = (itemId: string) =>
    String(stock.filter((s) => s.warehouseId === fromId && s.itemId === itemId).reduce((sum, s) => sum + Number(s.onHand), 0));

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = act(await createTransfer({ fromWarehouseId: fromId, toWarehouseId: toId, lines }));
      setTouched(false);
      router.push(`/inventory/transfers/${res.id}`);
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

      <div className="grid grid-cols-1 gap-3 card p-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("from")} *</span>
          <select className={field} value={fromId} onChange={(e) => setFromId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("to")} *</span>
          <select className={field} value={toId} onChange={(e) => setToId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="th">
              <th className="px-3 py-2">{t("item")}</th>
              <th className="w-28 px-3 py-2 text-right">{t("onHandSource")}</th>
              <th className="w-36 px-3 py-2 text-right">{t("qty")}</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = items.find((x) => x.id === l.itemId);
              return (
                <tr key={i} className="border-b border-line last:border-0">
                  <td className="px-2 py-1.5">
                    <select className={field} value={l.itemId} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}>
                      {items.map((x) => (
                        <option key={x.id} value={x.id}>{x.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-grey">{Number(onHand(l.itemId)).toLocaleString("en-US")} {it?.uom}</td>
                  <td className="px-2 py-1.5">
                    <input className={`${field} text-right`} placeholder="0" value={l.qty} onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button type="button" className="text-grey hover:text-danger" onClick={() => setLines(lines.filter((_, j) => j !== i))} disabled={lines.length === 1} aria-label={t("removeLine")}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <button type="button" className="btn-outline flex items-center gap-1.5" onClick={() => setLines([...lines, { itemId: items[0]?.id || "", qty: "" }])}>
          <Plus className="h-4 w-4" /> {t("addLine")}
        </button>
        <button type="button" disabled={busy} onClick={submit} className="btn-primary">
          {busy ? "…" : t("create")}
        </button>
      </div>
    </div>
  );
}
