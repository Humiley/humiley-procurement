"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2, Save, Send } from "lucide-react";
import {
  PrLinesEditor,
  newPrLine,
  type PrEditorLine,
  type CatalogItem,
  type UomOpt,
} from "./PrLinesEditor";
import { createPr, updatePr, submitPr } from "@/app/(portal)/requisitions/actions";
import type { PrFormPayload } from "@/lib/schemas/pr";

export type CostCenterOpt = { id: string; label: string };
export type ExistingPr = {
  id: string;
  costCenterId: string;
  neededByDate: string; // yyyy-mm-dd
  purpose: string;
  projectCode: string;
  lines: PrEditorLine[];
};

export function PrForm({
  costCenters,
  items,
  uoms,
  departmentLabel,
  existing,
}: {
  costCenters: CostCenterOpt[];
  items: CatalogItem[];
  uoms: UomOpt[];
  departmentLabel: string;
  existing?: ExistingPr;
}) {
  const t = useTranslations("pr");
  const fmtErr = useActionError();
  const tc = useTranslations("common");
  const router = useRouter();

  const [costCenterId, setCostCenterId] = useState(existing?.costCenterId || costCenters[0]?.id || "");
  const [neededByDate, setNeededByDate] = useState(existing?.neededByDate || "");
  const [purpose, setPurpose] = useState(existing?.purpose || "");
  const [projectCode, setProjectCode] = useState(existing?.projectCode || "");
  const [lines, setLines] = useState<PrEditorLine[]>(
    existing?.lines.length ? existing.lines : [newPrLine()],
  );
  const [busy, setBusy] = useState<"save" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  function buildPayload(): PrFormPayload {
    return {
      costCenterId,
      neededByDate,
      purpose,
      projectCode: projectCode || null,
      lines: lines.map((l) => ({
        itemId: l.itemId || null,
        freeTextDescription: l.freeTextDescription || null,
        uomId: l.uomId,
        qty: l.qty || "0",
        estUnitPriceVnd: l.unitPrice || "0",
        isCapex: l.isCapex,
        note: l.note || null,
      })),
    };
  }

  async function save(thenSubmit: boolean) {
    setError(null);
    setBusy(thenSubmit ? "submit" : "save");
    try {
      let id = existing?.id;
      if (existing) {
        await updatePr(existing.id, buildPayload());
      } else {
        const r = await createPr(buildPayload());
        id = r.id;
      }
      if (thenSubmit && id) await submitPr(id);
      router.push(`/requisitions/${id}`);
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-grey">{t("header")}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t("department")}</label>
            <input className="field bg-panel text-grey" value={departmentLabel} disabled />
          </div>
          <div>
            <label className="label">
              {t("costCenter")} <span className="text-danger">*</span>
            </label>
            <select className="field" value={costCenterId} onChange={(e) => setCostCenterId(e.target.value)}>
              {costCenters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">
              {t("neededBy")} <span className="text-danger">*</span>
            </label>
            <input
              type="date"
              className="field"
              value={neededByDate}
              onChange={(e) => setNeededByDate(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("projectCode")}</label>
            <input className="field" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">
              {t("purpose")} <span className="text-danger">*</span>
            </label>
            <textarea
              className="field min-h-[60px]"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-grey">{t("lines")}</h2>
        <PrLinesEditor items={items} uoms={uoms} lines={lines} onChange={setLines} />
      </div>

      {error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">{error}</p>
      )}

      <div className="flex flex-wrap justify-end gap-2">
        <button className="btn-outline" onClick={() => save(false)} disabled={!!busy}>
          {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t("saveDraft")}
        </button>
        <button className="btn-primary" onClick={() => save(true)} disabled={!!busy}>
          {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {t("submit")}
        </button>
      </div>
      <p className="text-right text-xs text-grey">{tc("required")}: *</p>
    </div>
  );
}
