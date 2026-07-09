"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createRfq } from "@/app/(portal)/rfqs/actions";

export type RfqFormOpt = { id: string; label: string };
export type RfqFormLine = { itemId?: string | null; description: string; uomId?: string | null; qty: string };

/** §8 RFQ create form — from an approved PR (lines prefilled) or standalone; invite ≥1 vendors. */
export function RfqForm({
  vendors,
  uoms,
  fromPr,
  initialLines,
}: {
  vendors: RfqFormOpt[];
  uoms: RfqFormOpt[];
  fromPr?: { id: string; label: string } | null;
  initialLines: RfqFormLine[];
}) {
  const t = useTranslations("rfq");
  const fmtErr = useActionError();
  const router = useRouter();
  const [title, setTitle] = useState(fromPr ? `Sourcing for ${fromPr.label}` : "");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lines, setLines] = useState<RfqFormLine[]>(
    initialLines.length ? initialLines : [{ description: "", uomId: uoms[0]?.id || null, qty: "1" }],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function setLine(i: number, patch: Partial<RfqFormLine>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await createRfq({
        title,
        prId: fromPr?.id ?? null,
        dueDate,
        vendorIds: Array.from(selected),
        lines: lines.map((l) => ({ ...l, qty: String(l.qty) })),
      });
      router.push(`/rfqs/${res.id}`);
    } catch (e) {
      setError(fmtErr(e));
      setBusy(false);
    }
  }

  const field = "field w-full";
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-navy">{t("newTitle")}</h1>
      {fromPr ? <p className="rounded-lg bg-navy/5 px-3 py-2 text-sm text-navy">{t("fromPr", { ref: fromPr.label })}</p> : null}
      {error ? <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <div className="grid grid-cols-1 gap-3 rounded-xl border border-grey/20 bg-white p-4 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("title")} *</span>
          <input className={field} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("dueDate")} *</span>
          <input type="date" className={field} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <div className="sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("vendors")} * <span className="font-normal">({t("threeQuoteHint")})</span></span>
          <div className="flex flex-wrap gap-2">
            {vendors.map((v) => (
              <label key={v.id} className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm ${selected.has(v.id) ? "border-navy bg-navy/10 font-semibold text-navy" : "border-grey/30 text-grey hover:bg-grey/5"}`}>
                <input type="checkbox" className="hidden" checked={selected.has(v.id)} onChange={() => toggle(v.id)} />
                {v.label}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              <th className="px-3 py-2">{t("lineDesc")}</th>
              <th className="w-32 px-3 py-2">{t("uom")}</th>
              <th className="w-28 px-3 py-2 text-right">{t("qty")}</th>
              <th className="w-10 px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i} className="border-b border-grey/10 last:border-0">
                <td className="px-2 py-1.5"><input className={field} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} /></td>
                <td className="px-2 py-1.5">
                  <select className={field} value={l.uomId || ""} onChange={(e) => setLine(i, { uomId: e.target.value || null })}>
                    <option value="">—</option>
                    {uoms.map((u) => (<option key={u.id} value={u.id}>{u.label}</option>))}
                  </select>
                </td>
                <td className="px-2 py-1.5"><input className={`${field} text-right`} value={l.qty} onChange={(e) => setLine(i, { qty: e.target.value })} /></td>
                <td className="px-2 py-1.5"><button type="button" className="text-danger" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-grey/15 px-3 py-2">
          <button type="button" className="rounded-lg border border-grey/30 px-3 py-1 text-xs font-semibold text-grey hover:bg-grey/10"
            onClick={() => setLines((ls) => [...ls, { description: "", uomId: uoms[0]?.id || null, qty: "1" }])}>
            {t("addLine")}
          </button>
        </div>
      </div>

      <div className="flex justify-end">
        <button type="button" disabled={busy} onClick={submit} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "…" : t("create")}
        </button>
      </div>
    </div>
  );
}
