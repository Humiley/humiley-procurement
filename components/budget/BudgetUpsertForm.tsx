"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { upsertBudget } from "@/app/(portal)/budgets/actions";

export type BudgetOpt = { id: string; label: string };

/** §9 ADMIN: set (or create) the amount of a costCenter × category × FY budget row. */
export function BudgetUpsertForm({ costCenters, categories, fiscalYear }: { costCenters: BudgetOpt[]; categories: BudgetOpt[]; fiscalYear: number }) {
  const t = useTranslations("budgets");
  const fmtErr = useActionError();
  const router = useRouter();
  const [costCenterId, setCostCenterId] = useState(costCenters[0]?.id || "");
  const [categoryId, setCategoryId] = useState(categories[0]?.id || "");
  const [fy, setFy] = useState(String(fiscalYear));
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    setMsg(null);
    setBusy(true);
    try {
      await upsertBudget({ costCenterId, categoryId, fiscalYear: fy, amountVnd: amount.replace(/[,.\s]/g, "") });
      setMsg({ ok: true, text: t("saved") });
      setAmount("");
      router.refresh();
    } catch (e) {
      setMsg({ ok: false, text: fmtErr(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-grey/20 bg-white p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-grey">{t("adminTitle")}</h3>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("costCenter")}</span>
          <select className="field" value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
            {costCenters.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("category")}</span>
          <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("fiscalYear")}</span>
          <input className="field w-24" value={fy} onChange={(e) => setFy(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("amount")}</span>
          <input className="field w-44 text-right" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </label>
        <button type="button" disabled={busy || !amount} onClick={save} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "…" : t("saveButton")}
        </button>
        {msg ? <p className={`text-sm ${msg.ok ? "text-emerald" : "text-danger"}`}>{msg.text}</p> : null}
      </div>
    </div>
  );
}
