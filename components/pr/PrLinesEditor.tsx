"use client";

import { Plus, Trash2, PackageCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { MoneyInput } from "@/components/shared/MoneyInput";

export type PrEditorLine = {
  key: string;
  itemId: string; // "" = free text
  freeTextDescription: string;
  uomId: string;
  qty: string;
  unitPrice: string; // integer VND string
  note: string;
  isCapex: boolean;
};

export type CatalogItem = {
  id: string;
  label: string; // "CODE · Name"
  uomId: string;
  lastPriceVnd: string; // integer string, "" if none
  freeStock: string; // on-hand qty across warehouses ("" if none) — §5 stock hint
};
export type UomOpt = { id: string; label: string };

const vnd = { format: (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + "\u00A0₫" };

export function newPrLine(): PrEditorLine {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    itemId: "",
    freeTextDescription: "",
    uomId: "",
    qty: "1",
    unitPrice: "",
    note: "",
    isCapex: false,
  };
}

export function prLineAmount(l: Pick<PrEditorLine, "qty" | "unitPrice">): number {
  return Math.round(Number(l.qty || 0) * Number(l.unitPrice || 0));
}

export function PrLinesEditor({
  items,
  uoms,
  lines,
  onChange,
}: {
  items: CatalogItem[];
  uoms: UomOpt[];
  lines: PrEditorLine[];
  onChange: (lines: PrEditorLine[]) => void;
}) {
  const t = useTranslations("pr");
  const total = lines.reduce((s, l) => s + prLineAmount(l), 0);

  function update(key: string, patch: Partial<PrEditorLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function pickItem(key: string, itemId: string) {
    if (!itemId) {
      update(key, { itemId: "", uomId: "", unitPrice: "" });
      return;
    }
    const it = items.find((i) => i.id === itemId);
    update(key, {
      itemId,
      freeTextDescription: "",
      uomId: it?.uomId || "",
      unitPrice: it?.lastPriceVnd || "",
    });
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr>
              <th className="th w-8 text-center">#</th>
              <th className="th">{t("thItem")}</th>
              <th className="th w-28">{t("thUom")}</th>
              <th className="th w-24 text-right">{t("qty")}</th>
              <th className="th w-40 text-right">{t("unitPrice")}</th>
              <th className="th w-40 text-right">{t("amount")}</th>
              <th className="th w-10" />
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td className="td text-center text-grey" colSpan={7}>
                  {t("linesEmpty")}
                </td>
              </tr>
            )}
            {lines.map((l, i) => (
              <tr key={l.key}>
                <td className="td text-center text-grey">{i + 1}</td>
                <td className="td">
                  <select
                    className="field"
                    value={l.itemId}
                    aria-label={t("thItem")}
                    onChange={(e) => pickItem(l.key, e.target.value)}
                  >
                    <option value="">{t("freeText")}</option>
                    {items.map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.label}
                      </option>
                    ))}
                  </select>
                  {!l.itemId && (
                    <input
                      className="field mt-1"
                      placeholder={t("freeTextPlaceholder")}
                      aria-label={t("freeTextPlaceholder")}
                      value={l.freeTextDescription}
                      onChange={(e) => update(l.key, { freeTextDescription: e.target.value })}
                    />
                  )}
                  {(() => {
                    const fs = l.itemId ? items.find((i) => i.id === l.itemId)?.freeStock : "";
                    return fs ? (
                      <p className="mt-1 flex items-center gap-1 text-xs text-emerald">
                        <PackageCheck className="h-3.5 w-3.5" />
                        {t("stockHint", { qty: fs })}
                      </p>
                    ) : null;
                  })()}
                </td>
                <td className="td">
                  <select
                    className="field"
                    value={l.uomId}
                    disabled={!!l.itemId}
                    aria-label={t("thUom")}
                    onChange={(e) => update(l.key, { uomId: e.target.value })}
                  >
                    <option value="">—</option>
                    {uoms.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="td">
                  <input
                    className="field text-right tabular-nums"
                    inputMode="decimal"
                    aria-label={t("qty")}
                    value={l.qty}
                    onChange={(e) => update(l.key, { qty: e.target.value.replace(/[^\d.]/g, "") })}
                  />
                </td>
                <td className="td">
                  <MoneyInput value={l.unitPrice} ariaLabel={t("unitPrice")} onChange={(raw) => update(l.key, { unitPrice: raw })} />
                </td>
                <td className="td text-right font-medium tabular-nums">
                  {vnd.format(prLineAmount(l))}
                </td>
                <td className="td text-center">
                  <button
                    type="button"
                    className="btn-ghost text-danger"
                    onClick={() => onChange(lines.filter((x) => x.key !== l.key))}
                    aria-label={t("removeLine")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          {lines.length > 0 && (
            <tfoot>
              <tr>
                <td className="td text-right font-semibold text-navy" colSpan={5}>
                  {t("estimatedTotal")}
                </td>
                <td className="td text-right font-bold text-navy tabular-nums">{vnd.format(total)}</td>
                <td className="td" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <button type="button" className="btn-outline" onClick={() => onChange([...lines, newPrLine()])}>
        <Plus className="h-4 w-4" /> {t("addLine")}
      </button>
    </div>
  );
}
