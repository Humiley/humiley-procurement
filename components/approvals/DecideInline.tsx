"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, X, RotateCcw, type LucideIcon } from "lucide-react";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { decideEntity } from "@/app/(portal)/approvals/actions";
import type { Decision } from "@/lib/workflow/engine";
import { act } from "@/lib/act";
import { toast } from "@/components/shared/Toaster";

/** The decision bar shown on a document page to the approver whose turn it is (§6 + §19). */
export function DecideInline({
  entityType,
  entityId,
  refLabel,
}: {
  entityType: "PR" | "PO" | "VENDOR" | "PAYMENT_REQUEST" | "GOODS_ISSUE";
  entityId: string;
  refLabel: string;
}) {
  const t = useTranslations("approvals");
  const tc = useTranslations("common");
  const router = useRouter();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [, startTransition] = useTransition();

  async function onSign(payload: SignaturePayload) {
    if (!decision) return;
    act(await decideEntity({ entityType, entityId, decision, password: payload.password, comment: payload.reason }));
    setDecision(null);
    toast(tc("done"));
    startTransition(() => router.refresh());
  }

  const btn = (d: Decision, cls: string, Icon: LucideIcon, label: string) => (
    <button type="button" onClick={() => setDecision(d)} className={cls}>
      <Icon className="h-3 w-3" /> {label}
    </button>
  );

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-navy/20 bg-navy/5 p-3">
      <span className="text-sm font-semibold text-navy">{t("yourTurn")}</span>
      <div className="ml-auto flex gap-2">
        {btn("APPROVED", "btn-approve", Check, t("approve"))}
        {btn(
          "RETURNED",
          "inline-flex items-center gap-[5px] rounded-md bg-[#FEF3C7] px-2.5 py-[5px] text-xs font-bold text-[#92400E] transition hover:bg-[#FDE68A]",
          RotateCcw,
          t("return"),
        )}
        {btn("REJECTED", "btn-reject", X, t("reject"))}
      </div>
      <SignatureDialog
        open={!!decision}
        onClose={() => setDecision(null)}
        onConfirm={onSign}
        title={t("signTitle")}
        context={refLabel}
        meanings={decision ? [decision] : []}
        meaningLabel={(m) => t(`meaning.${m}`)}
        submitLabel={t("signSubmit")}
        requireReason={!!decision && decision !== "APPROVED"}
      />
    </div>
  );
}
