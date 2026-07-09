"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FilePlus2 } from "lucide-react";
import { generateReorderPr } from "@/app/(portal)/inventory/reorder/actions";
import type { ReorderBreach } from "@/lib/stock/reorder";
import { act } from "@/lib/act";

export type ReorderOpt = { id: string; label: string };

/** §10b one-click reorder: pick breached items → draft PR (source=REORDER). */
export function ReorderPanel({ breaches, costCenters, canGenerate }: { breaches: ReorderBreach[]; costCenters: ReorderOpt[]; canGenerate: boolean }) {
  const t = useTranslations("reorder");
  const fmtErr = useActionError();
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set(breaches.map((b) => `${b.warehouseId}|${b.itemId}`)));
  const [costCenterId, setCostCenterId] = useState(costCenters[0]?.id || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) => {
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
  };

  async function generate() {
    setError(null);
    const chosen = breaches.filter((b) => selected.has(`${b.warehouseId}|${b.itemId}`));
    if (!chosen.length) return setError(t("pickOne"));
    const byWh = new Map<string, string[]>();
    for (const b of chosen) byWh.set(b.warehouseId, [...(byWh.get(b.warehouseId) ?? []), b.itemId]);
    setBusy(true);
    try {
      let lastId = "";
      for (const [warehouseId, itemIds] of Array.from(byWh.entries())) {
        const res = act(await generateReorderPr({ warehouseId, costCenterId, itemIds }));
        lastId = res.id;
      }
      router.push(`/requisitions/${lastId}`);
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  if (breaches.length === 0) {
    return <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("none")}</p>;
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              <th className="w-8 px-3 py-2.5" />
              <th className="px-3 py-2.5">{t("colWarehouse")}</th>
              <th className="px-3 py-2.5">{t("colItem")}</th>
              <th className="px-3 py-2.5 text-right">{t("colOnHand")}</th>
              <th className="px-3 py-2.5 text-right">{t("colOpenPo")}</th>
              <th className="px-3 py-2.5 text-right">{t("colMin")}</th>
              <th className="px-3 py-2.5 text-right">{t("colReorder")}</th>
            </tr>
          </thead>
          <tbody>
            {breaches.map((b) => {
              const key = `${b.warehouseId}|${b.itemId}`;
              return (
                <tr key={key} className="border-b border-grey/10 last:border-0">
                  <td className="px-3 py-2.5">
                    {canGenerate ? <input type="checkbox" checked={selected.has(key)} onChange={() => toggle(key)} /> : null}
                  </td>
                  <td className="px-3 py-2.5 font-semibold">{b.warehouseCode}</td>
                  <td className="px-3 py-2.5">{b.itemLabel}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-danger">{Number(b.onHand).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{Number(b.openPoQty).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{Number(b.minQty).toLocaleString("en-US")}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-navy">{Number(b.reorderQty).toLocaleString("en-US")} {b.uom}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canGenerate ? (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <select className="field" value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <button type="button" disabled={busy} onClick={generate} className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
            <FilePlus2 className="h-4 w-4" /> {busy ? "…" : t("generate")}
          </button>
        </div>
      ) : null}
    </div>
  );
}
