"use client";

import { useState, useTransition } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/shared/Toaster";
import { TextPromptDialog } from "@/components/shared/TextPromptDialog";
import { ShieldCheck } from "lucide-react";
import { submitVendorForApproval, blacklistVendor } from "@/app/(portal)/vendors/actions";
import { act } from "@/lib/act";

export type VendorLcRow = { id: string; code: string; nameEn: string; status: string };

/** §7 vendor lifecycle panel: submit drafts for Director approval; blacklist approved vendors. */
export function VendorLifecyclePanel({ rows, canManage }: { rows: VendorLcRow[]; canManage: boolean }) {
  const t = useTranslations("vendors.lifecycle");
  const tcm = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [blacklistFor, setBlacklistFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  const actionable = rows.filter((r) => r.status === "DRAFT" || r.status === "PENDING" || r.status === "APPROVED");
  if (!canManage || actionable.length === 0) return null;

  async function run(id: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(id);
    try {
      act(await fn());
      toast(tcm("done"));
      start(() => router.refresh());
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-grey/20 bg-white p-4">
      <div className="mb-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-navy" />
        <h2 className="text-sm font-bold text-navy">{t("title")}</h2>
      </div>
      {error ? <p className="mb-2 rounded bg-danger/10 px-2 py-1 text-xs text-danger">{error}</p> : null}
      <ul className="space-y-1.5">
        {actionable.map((v) => (
          <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-grey/10 px-3 py-1.5 text-sm">
            <span className="font-mono text-xs font-bold text-navy">{v.code}</span>
            <span className="min-w-0 flex-1 truncate">{v.nameEn}</span>
            <span className="rounded bg-grey/10 px-1.5 py-0.5 text-[10px] font-bold text-grey">{v.status}</span>
            {v.status === "DRAFT" ? (
              <button
                className="rounded-lg bg-navy px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
                disabled={busy === v.id}
                onClick={() => run(v.id, () => submitVendorForApproval(v.id))}
              >
                {busy === v.id ? "…" : t("submit")}
              </button>
            ) : null}
            {v.status === "PENDING" ? <span className="text-xs text-grey">{t("pendingNote")}</span> : null}
            {v.status === "APPROVED" ? (
              <button
                className="rounded-lg border border-danger/30 px-2.5 py-1 text-xs font-semibold text-danger hover:bg-danger/5 disabled:opacity-50"
                disabled={busy === v.id}
                onClick={() => setBlacklistFor(v.id)}
              >
                {busy === v.id ? "…" : t("blacklist")}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <TextPromptDialog
        open={!!blacklistFor}
        title={t("blacklist")}
        label={t("blacklistReason")}
        danger
        onClose={() => setBlacklistFor(null)}
        onConfirm={async (reason) => {
          const id = blacklistFor!;
          setBlacklistFor(null);
          await run(id, () => blacklistVendor(id, reason));
        }}
      />
    </div>
  );
}
