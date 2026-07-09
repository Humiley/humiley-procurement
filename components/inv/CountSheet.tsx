"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Save, ClipboardCheck } from "lucide-react";
import { SignatureDialog } from "@/components/shared/SignatureDialog";
import { saveCounts, postCount } from "@/app/(portal)/inventory/counts/actions";
import { act } from "@/lib/act";
import { toast } from "@/components/shared/Toaster";

export type CountLineRow = { lineId: string; label: string; uom: string; systemQty: string; countedQty: string };

/** §10b count sheet — keeper edits counted quantities; a DIRECTOR posts the signed adjustments. */
export function CountSheet({
  id,
  status,
  canEdit,
  canPost,
  lines,
}: {
  id: string;
  status: string;
  canEdit: boolean;
  canPost: boolean;
  lines: CountLineRow[];
}) {
  const t = useTranslations("cnt");
  const tcm = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [counted, setCounted] = useState<Record<string, string>>(Object.fromEntries(lines.map((l) => [l.lineId, l.countedQty])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signOpen, setSignOpen] = useState(false);

  const variance = (l: CountLineRow) => Number(counted[l.lineId] || 0) - Number(l.systemQty);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      act(await saveCounts({ countId: id, lines: lines.map((l) => ({ lineId: l.lineId, countedQty: counted[l.lineId] || "0" })) }));
      toast(tcm("done"));
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  const open = status === "COUNTING";
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              <th className="px-3 py-2.5">{t("item")}</th>
              <th className="w-28 px-3 py-2.5 text-right">{t("systemQty")}</th>
              <th className="w-36 px-3 py-2.5 text-right">{t("countedQty")}</th>
              <th className="w-28 px-3 py-2.5 text-right">{t("variance")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const v = variance(l);
              return (
                <tr key={l.lineId} className="border-b border-grey/10 last:border-0">
                  <td className="px-3 py-2.5">{l.label}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{Number(l.systemQty).toLocaleString("en-US")} {l.uom}</td>
                  <td className="px-2 py-1.5">
                    {open && canEdit ? (
                      <input className="field w-full text-right" value={counted[l.lineId] ?? ""} onChange={(e) => setCounted({ ...counted, [l.lineId]: e.target.value })} />
                    ) : (
                      <span className="block text-right tabular-nums">{Number(l.countedQty).toLocaleString("en-US")}</span>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 text-right font-semibold tabular-nums ${v === 0 ? "text-grey" : v > 0 ? "text-emerald" : "text-danger"}`}>
                    {v > 0 ? "+" : ""}{v.toLocaleString("en-US")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {open ? (
        <div className="flex justify-end gap-2">
          {canEdit ? (
            <button type="button" disabled={busy} onClick={save} className="btn-outline flex items-center gap-1.5">
              <Save className="h-4 w-4" /> {t("save")}
            </button>
          ) : null}
          {canPost ? (
            <button type="button" onClick={() => setSignOpen(true)} className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
              <ClipboardCheck className="h-4 w-4" /> {t("post")}
            </button>
          ) : null}
        </div>
      ) : null}

      <SignatureDialog
        open={signOpen}
        onClose={() => setSignOpen(false)}
        title={t("signTitle")}
        meanings={["COUNTED"]}
        meaningLabel={() => t("meaningCounted")}
        submitLabel={t("post")}
        onConfirm={async (p) => {
          act(await postCount({ id, password: p.password, reason: p.reason }));
          toast(tcm("done"));
          setSignOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
