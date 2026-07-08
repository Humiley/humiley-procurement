"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { createGoodsIssue } from "@/app/(portal)/inventory/issues/actions";

export type GiOpt = { id: string; label: string };
export type GiItemOpt = { id: string; label: string; uom: string };
export type GiStockRow = { warehouseId: string; itemId: string; onHand: string };

type Line = { itemId: string; qty: string };

/** §10b goods-issue request — pick warehouse + cost center, add item lines with an on-hand hint. */
export function GiForm({
  warehouses,
  costCenters,
  items,
  stock,
}: {
  warehouses: GiOpt[];
  costCenters: GiOpt[];
  items: GiItemOpt[];
  stock: GiStockRow[];
}) {
  const t = useTranslations("gi");
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "");
  const [costCenterId, setCostCenterId] = useState(costCenters[0]?.id || "");
  const [projectCode, setProjectCode] = useState("");
  const [purpose, setPurpose] = useState("");
  const [lines, setLines] = useState<Line[]>([{ itemId: items[0]?.id || "", qty: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onHand = (itemId: string) =>
    stock.find((s) => s.warehouseId === warehouseId && s.itemId === itemId)?.onHand ?? "0";

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await createGoodsIssue({ warehouseId, costCenterId, projectCode, purpose, lines });
      router.push(`/inventory/issues/${res.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the goods issue.");
      setBusy(false);
    }
  }

  const field = "field w-full";
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-navy">{t("newTitle")}</h1>
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-grey/20 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("warehouse")} *</span>
          <select className={field} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("costCenter")} *</span>
          <select className={field} value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("projectCode")}</span>
          <input className={field} value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("purpose")} *</span>
          <input className={field} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder={t("purposePh")} />
        </label>
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              <th className="px-3 py-2">{t("item")}</th>
              <th className="w-28 px-3 py-2 text-right">{t("onHand")}</th>
              <th className="w-36 px-3 py-2 text-right">{t("qty")}</th>
              <th className="w-12 px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const it = items.find((x) => x.id === l.itemId);
              return (
                <tr key={i} className="border-b border-grey/10 last:border-0">
                  <td className="px-2 py-1.5">
                    <select
                      className={field}
                      value={l.itemId}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, itemId: e.target.value } : x)))}
                    >
                      {items.map((x) => (
                        <option key={x.id} value={x.id}>{x.label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-grey">
                    {Number(onHand(l.itemId)).toLocaleString("en-US")} {it?.uom}
                  </td>
                  <td className="px-2 py-1.5">
                    <input
                      className={`${field} text-right`}
                      placeholder="0"
                      value={l.qty}
                      onChange={(e) => setLines(lines.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))}
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      type="button"
                      className="text-grey hover:text-danger"
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}
                      disabled={lines.length === 1}
                      aria-label={t("removeLine")}
                    >
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
        <button
          type="button"
          className="btn-outline flex items-center gap-1.5"
          onClick={() => setLines([...lines, { itemId: items[0]?.id || "", qty: "" }])}
        >
          <Plus className="h-4 w-4" /> {t("addLine")}
        </button>
        <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "…" : t("create")}
        </button>
      </div>
    </div>
  );
}
