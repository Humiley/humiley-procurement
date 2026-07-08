"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send, PackageMinus } from "lucide-react";
import { SignatureDialog } from "@/components/shared/SignatureDialog";
import { submitGoodsIssue, executeGoodsIssue } from "@/app/(portal)/inventory/issues/actions";

export type GiExecLine = { lineId: string; label: string; uom: string; requested: string; onHand: string };

/** Requester submits a draft; WAREHOUSE executes an approved issue under the §19 ISSUED signature. */
export function GiDetailActions({
  id,
  status,
  isRequester,
  canExecute,
  execLines,
}: {
  id: string;
  status: string;
  isRequester: boolean;
  canExecute: boolean;
  execLines: GiExecLine[];
}) {
  const t = useTranslations("gi");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [qty, setQty] = useState<Record<string, string>>(
    Object.fromEntries(execLines.map((l) => [l.lineId, l.requested])),
  );

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      await submitGoodsIssue(id);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "DRAFT" && isRequester) {
    return (
      <div className="flex items-center gap-3">
        <button type="button" disabled={busy} onClick={submit} className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          <Send className="h-4 w-4" /> {t("submit")}
        </button>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
      </div>
    );
  }

  if (status === "APPROVED" && canExecute) {
    return (
      <div className="space-y-3 rounded-xl border border-emerald/30 bg-emerald/5 p-4">
        <h3 className="text-sm font-bold text-navy">{t("executeTitle")}</h3>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2">{t("item")}</th>
                <th className="w-28 px-3 py-2 text-right">{t("requested")}</th>
                <th className="w-28 px-3 py-2 text-right">{t("onHand")}</th>
                <th className="w-32 px-3 py-2 text-right">{t("issueNow")}</th>
              </tr>
            </thead>
            <tbody>
              {execLines.map((l) => (
                <tr key={l.lineId} className="border-b border-grey/10 last:border-0">
                  <td className="px-3 py-2">{l.label}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{Number(l.requested).toLocaleString("en-US")} {l.uom}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-grey">{Number(l.onHand).toLocaleString("en-US")}</td>
                  <td className="px-2 py-1.5">
                    <input
                      className="field w-full text-right"
                      value={qty[l.lineId] ?? ""}
                      onChange={(e) => setQty({ ...qty, [l.lineId]: e.target.value })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex justify-end">
          <button type="button" onClick={() => setSignOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <PackageMinus className="h-4 w-4" /> {t("executeButton")}
          </button>
        </div>
        <SignatureDialog
          open={signOpen}
          onClose={() => setSignOpen(false)}
          title={t("signTitle")}
          meanings={["ISSUED"]}
          meaningLabel={() => t("meaningIssued")}
          submitLabel={t("executeButton")}
          onConfirm={async (p) => {
            setError(null);
            try {
              await executeGoodsIssue({
                payload: { issueId: id, lines: execLines.map((l) => ({ lineId: l.lineId, qtyIssued: qty[l.lineId] || "0" })) },
                password: p.password,
              });
              setSignOpen(false);
              router.refresh();
            } catch (e) {
              throw e instanceof Error ? e : new Error("Issue failed.");
            }
          }}
        />
      </div>
    );
  }

  return null;
}
