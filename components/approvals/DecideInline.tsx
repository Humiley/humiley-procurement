"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { decideEntity } from "@/app/(portal)/approvals/actions";
import type { Decision } from "@/lib/workflow/engine";

/** The decision bar shown on a document page to the approver whose turn it is (§6 + §19). */
export function DecideInline({
  entityType,
  entityId,
  refLabel,
}: {
  entityType: "PR" | "PO" | "VENDOR" | "PAYMENT_REQUEST";
  entityId: string;
  refLabel: string;
}) {
  const t = useTranslations("approvals");
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [, startTransition] = useTransition();

  async function onSign(payload: SignaturePayload) {
    if (!decision) return;
    await decideEntity({ entityType, entityId, decision, password: payload.password, comment: payload.reason });
    setDecision(null);
    startTransition(() => router.refresh());
  }

  const btn = (d: Decision, cls: string, label: string) => (
    <button type="button" onClick={() => setDecision(d)} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${cls}`}>
      {label}
    </button>
  );

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 p-3">
      <span className="text-sm font-semibold text-navy">{t("yourTurn")}</span>
      <div className="ml-auto flex gap-2">
        {btn("APPROVED", "bg-emerald text-white hover:opacity-90", t("approve"))}
        {btn("RETURNED", "bg-warning/15 text-warning hover:bg-warning/25", t("return"))}
        {btn("REJECTED", "bg-danger/10 text-danger hover:bg-danger/20", t("reject"))}
      </div>
      <SignatureDialog
        open={!!decision}
        onClose={() => setDecision(null)}
        onConfirm={onSign}
        title={`${t("signTitle")} — ${refLabel}`}
        meanings={decision ? [decision] : []}
        meaningLabel={(m) => t(`meaning.${m}`)}
        submitLabel={t("signSubmit")}
        requireReason={!!decision && decision !== "APPROVED"}
      />
    </div>
  );
}
