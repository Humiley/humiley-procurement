"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { CheckSquare, AlertTriangle } from "lucide-react";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { decidePr } from "@/app/(portal)/approvals/actions";
import type { Decision } from "@/lib/workflow/engine";

export type QueueRow = {
  stepId: string;
  prId: string;
  prNumber: string;
  purpose: string;
  requesterName: string;
  departmentCode: string;
  total: string;
  level: number;
  levelLabel: string;
  submitted: string;
  ageDays: number;
  slaDue: string | null;
  overdue: boolean;
};

/** "Waiting for me" queue (§6) — approve / reject / return, each via the §19 signing ceremony. */
export function ApprovalsQueue({ rows }: { rows: QueueRow[] }) {
  const t = useTranslations("approvals");
  const router = useRouter();
  const [target, setTarget] = useState<{ row: QueueRow; decision: Decision } | null>(null);
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<string | null>(null);

  async function onSign(payload: SignaturePayload) {
    if (!target) return;
    await decidePr({
      prId: target.row.prId,
      decision: target.decision,
      password: payload.password,
      comment: payload.reason,
    });
    setTarget(null);
    setNotice(t("decided", { ref: target.row.prNumber }));
    startTransition(() => router.refresh());
  }

  const decideBtn = (row: QueueRow, decision: Decision, cls: string, label: string) => (
    <button
      type="button"
      onClick={() => setTarget({ row, decision })}
      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${cls}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckSquare className="h-5 w-5 text-navy" />
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
        <span className="rounded-full bg-navy/10 px-2 py-0.5 text-xs font-bold text-navy">{rows.length}</span>
      </div>
      {notice ? <p className="rounded-lg bg-emerald/10 px-3 py-2 text-sm text-emerald">{notice}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
                <th className="px-3 py-2.5">{t("colRef")}</th>
                <th className="px-3 py-2.5">{t("colPurpose")}</th>
                <th className="px-3 py-2.5">{t("colRequester")}</th>
                <th className="px-3 py-2.5">{t("colDept")}</th>
                <th className="px-3 py-2.5 text-right">{t("colAmount")}</th>
                <th className="px-3 py-2.5">{t("colLevel")}</th>
                <th className="px-3 py-2.5">{t("colAge")}</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stepId} className="border-b border-grey/10 last:border-0 hover:bg-grey/5">
                  <td className="px-3 py-2.5 font-mono text-xs font-bold text-navy">
                    <Link href={`/requisitions/${r.prId}`} className="hover:underline">
                      {r.prNumber}
                    </Link>
                  </td>
                  <td className="max-w-[260px] truncate px-3 py-2.5" title={r.purpose}>{r.purpose}</td>
                  <td className="px-3 py-2.5">{r.requesterName}</td>
                  <td className="px-3 py-2.5">{r.departmentCode}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-navy">{r.total} ₫</td>
                  <td className="px-3 py-2.5 text-xs">
                    L{r.level} · {r.levelLabel}
                  </td>
                  <td className="px-3 py-2.5 text-xs">
                    {r.ageDays}d
                    {r.overdue ? (
                      <span className="ml-1 inline-flex items-center gap-0.5 text-warning" title={t("overdue", { due: r.slaDue ?? "" })}>
                        <AlertTriangle className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex justify-end gap-1.5">
                      {decideBtn(r, "APPROVED", "bg-emerald text-white hover:opacity-90", t("approve"))}
                      {decideBtn(r, "RETURNED", "bg-warning/15 text-warning hover:bg-warning/25", t("return"))}
                      {decideBtn(r, "REJECTED", "bg-danger/10 text-danger hover:bg-danger/20", t("reject"))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SignatureDialog
        open={!!target}
        onClose={() => setTarget(null)}
        onConfirm={onSign}
        title={target ? `${t("signTitle")} — ${target.row.prNumber}` : ""}
        meanings={target ? [target.decision] : []}
        meaningLabel={(m) => t(`meaning.${m}`)}
        submitLabel={pending ? "…" : t("signSubmit")}
        requireReason={!!target && target.decision !== "APPROVED"}
      />
    </div>
  );
}
