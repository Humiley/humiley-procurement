"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createGrn } from "@/app/(portal)/goods-receipts/actions";
import { act } from "@/lib/act";

export type GrnPoOpt = { id: string; label: string };
export type GrnPoLine = { poLineId: string; description: string; uom: string; ordered: string; outstanding: string };

/** §9 GRN entry — pick an open PO, see outstanding per line, enter received qty (over-receipt blocked server-side too). */
export function GrnForm({
  pos,
  warehouses,
  selectedPoId,
  lines,
}: {
  pos: GrnPoOpt[];
  warehouses: GrnPoOpt[];
  selectedPoId?: string | null;
  lines: GrnPoLine[];
}) {
  const t = useTranslations("grn");
  const tc = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    // Pre-submit check: at least one line must actually receive a quantity.
    if (!lines.some((l) => Number(qty[l.poLineId] || "0") > 0)) {
      setError(tc("required"));
      return;
    }
    setBusy(true);
    try {
      const res = act(await createGrn({
        poId: selectedPoId!,
        warehouseId,
        notes,
        lines: lines.map((l) => ({ poLineId: l.poLineId, qtyReceived: qty[l.poLineId] || "0" })),
      }));
      router.push(`/goods-receipts/${res.id}`);
    } catch (e) {
      setError(fmtErr(e));
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
          <select
            className={field}
            value={selectedPoId || ""}
            onChange={(e) => router.push(`/goods-receipts/new?po=${e.target.value}`)}
          >
            <option value="">—</option>
            {pos.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("warehouse")} *</span>
          <select className={field} value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("notes")}</span>
          <input className={field} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>

      {selectedPoId && lines.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                  <th className="px-3 py-2">{t("lineDesc")}</th>
                  <th className="w-20 px-3 py-2">{t("uom")}</th>
                  <th className="w-28 px-3 py-2 text-right">{t("ordered")}</th>
                  <th className="w-28 px-3 py-2 text-right">{t("outstanding")}</th>
                  <th className="w-36 px-3 py-2 text-right">{t("receiveNow")}</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.poLineId} className="border-b border-grey/10 last:border-0">
                    <td className="px-3 py-2">{l.description}</td>
                    <td className="px-3 py-2">{l.uom}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{l.ordered}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums text-navy">{l.outstanding}</td>
                    <td className="px-2 py-1.5">
                      <input
                        className={`${field} text-right`}
                        placeholder="0"
                        value={qty[l.poLineId] ?? ""}
                        onChange={(e) => setQty({ ...qty, [l.poLineId]: e.target.value })}
                      />
                    </td>
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
        <p className="rounded-xl border border-grey/20 bg-white p-4 text-sm text-grey">{t("nothingOutstanding")}</p>
      ) : (
        <p className="rounded-xl border border-grey/20 bg-white p-4 text-sm text-grey">{t("pickPo")}</p>
      )}
    </div>
  );
}
