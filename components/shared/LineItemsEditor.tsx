"use client";

import { Plus, Trash2, PackageSearch } from "lucide-react";
import { MoneyInput } from "./MoneyInput";

export type EditorLine = {
  key: string;
  itemId?: string | null;
  description: string;
  uom?: string;
  qty: string; // numeric string, up to 4dp
  unitPrice: string; // integer VND string
  stockHint?: string | null;
};

const vnd = { format: (n: number) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n) + "\u00A0₫" };

export function lineAmountNumber(l: Pick<EditorLine, "qty" | "unitPrice">): number {
  return Math.round(Number(l.qty || 0) * Number(l.unitPrice || 0));
}

export function newEditorLine(): EditorLine {
  return {
    key: typeof crypto !== "undefined" ? crypto.randomUUID() : String(Math.random()),
    description: "",
    qty: "1",
    unitPrice: "",
  };
}

/**
 * Editable line grid (spec §22.3 <LineItemsEditor>) — reused by PR/PO/quote/invoice/GRN/issue
 * via column toggles. Line amount = qty × unitPrice (display); the server re-computes with
 * lib/money (Decimal) on submit — never trust these client numbers for persistence.
 */
export function LineItemsEditor({
  lines,
  onChange,
  showUom = true,
  showPrice = true,
  readOnly = false,
  descriptionPlaceholder = "Item / description",
  onPickItem,
}: {
  lines: EditorLine[];
  onChange: (lines: EditorLine[]) => void;
  showUom?: boolean;
  showPrice?: boolean;
  readOnly?: boolean;
  descriptionPlaceholder?: string;
  onPickItem?: (key: string) => void;
}) {
  const total = lines.reduce((s, l) => s + lineAmountNumber(l), 0);

  function update(key: string, patch: Partial<EditorLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key));
  }

  return (
    <div className="space-y-2">
      <div className="overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className="th w-8 text-center">#</th>
              <th className="th">Description</th>
              {showUom && <th className="th w-24">UoM</th>}
              <th className="th w-28 text-right">Qty</th>
              {showPrice && <th className="th w-40 text-right">Unit price</th>}
              {showPrice && <th className="th w-40 text-right">Amount</th>}
              {!readOnly && <th className="th w-10" />}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td className="td text-center text-grey" colSpan={showPrice ? 7 : 4}>
                  No lines yet.
                </td>
              </tr>
            )}
            {lines.map((l, i) => (
              <tr key={l.key}>
                <td className="td text-center text-grey">{i + 1}</td>
                <td className="td">
                  <div className="flex items-center gap-1">
                    <input
                      className="field"
                      value={l.description}
                      placeholder={descriptionPlaceholder}
                      readOnly={readOnly}
                      onChange={(e) => update(l.key, { description: e.target.value })}
                    />
                    {onPickItem && !readOnly && (
                      <button
                        type="button"
                        className="btn-ghost shrink-0"
                        onClick={() => onPickItem(l.key)}
                        aria-label="Pick catalog item"
                      >
                        <PackageSearch className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  {l.stockHint && (
                    <p className="mt-0.5 text-xs text-emerald">{l.stockHint}</p>
                  )}
                </td>
                {showUom && (
                  <td className="td">
                    <input
                      className="field"
                      value={l.uom ?? ""}
                      readOnly={readOnly}
                      onChange={(e) => update(l.key, { uom: e.target.value })}
                    />
                  </td>
                )}
                <td className="td">
                  <input
                    className="field text-right tabular-nums"
                    inputMode="decimal"
                    value={l.qty}
                    readOnly={readOnly}
                    onChange={(e) =>
                      update(l.key, { qty: e.target.value.replace(/[^\d.]/g, "") })
                    }
                  />
                </td>
                {showPrice && (
                  <td className="td">
                    <MoneyInput
                      value={l.unitPrice}
                      onChange={(raw) => update(l.key, { unitPrice: raw })}
                      disabled={readOnly}
                    />
                  </td>
                )}
                {showPrice && (
                  <td className="td text-right font-medium tabular-nums">
                    {vnd.format(lineAmountNumber(l))}
                  </td>
                )}
                {!readOnly && (
                  <td className="td text-center">
                    <button
                      type="button"
                      className="btn-ghost text-danger"
                      onClick={() => remove(l.key)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {showPrice && lines.length > 0 && (
            <tfoot>
              <tr>
                <td className="td text-right font-semibold text-navy" colSpan={showUom ? 5 : 4}>
                  Total
                </td>
                <td className="td text-right font-bold text-navy tabular-nums">
                  {vnd.format(total)}
                </td>
                {!readOnly && <td className="td" />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {!readOnly && (
        <button
          type="button"
          className="btn-outline"
          onClick={() => onChange([...lines, newEditorLine()])}
        >
          <Plus className="h-4 w-4" /> Add line
        </button>
      )}
    </div>
  );
}
