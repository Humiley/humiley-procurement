"use client";

import { useState, useTransition } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { submitPaymentRequest, verifyPaymentRequest, markPaymentRequestPaid, cancelPaymentRequest } from "@/app/(portal)/payment-requests/actions";

/** §10a lifecycle actions: submit, accountant verify (VERIFIED), execute payment (PAID + bank ref), cancel. */
export function PayReqDetailActions({
  id,
  number,
  status,
  isRequester,
  isAccountant,
  verified,
}: {
  id: string;
  number: string;
  status: string;
  isRequester: boolean;
  isAccountant: boolean;
  verified: boolean;
}) {
  const t = useTranslations("payreq");
  const fmtErr = useActionError();
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "verify" | "paid">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function run(kind: string, fn: () => Promise<unknown>) {
    setError(null);
    setBusy(kind);
    try {
      await fn();
      start(() => router.refresh());
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSign(payload: SignaturePayload) {
    try {
      if (dialog === "verify") await verifyPaymentRequest({ id, password: payload.password, comment: payload.reason });
      else await markPaymentRequestPaid({ id, password: payload.password, paymentRef: payload.reason || "" });
      setDialog(null);
      start(() => router.refresh());
    } catch (e) {
      setDialog(null);
      setError(fmtErr(e));
    }
  }

  const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      <a href={`/api/payment-request/${id}/pdf`} target="_blank" rel="noopener" className={`${btn} border border-navy/30 text-navy hover:bg-navy/5`}>
        {t("pdf")}
      </a>
      {isRequester && status === "DRAFT" ? (
        <button className={`${btn} bg-navy text-white hover:opacity-90`} disabled={!!busy} onClick={() => run("submit", () => submitPaymentRequest(id))}>
          {busy === "submit" ? "…" : t("submit")}
        </button>
      ) : null}
      {isAccountant && status === "SUBMITTED" && !verified ? (
        <button className={`${btn} bg-navy text-white hover:opacity-90`} onClick={() => { setError(null); setDialog("verify"); }}>
          {t("verify")}
        </button>
      ) : null}
      {isAccountant && status === "APPROVED" ? (
        <button className={`${btn} bg-emerald text-white hover:opacity-90`} onClick={() => { setError(null); setDialog("paid"); }}>
          {t("markPaid")}
        </button>
      ) : null}
      {(isRequester || isAccountant) && ["DRAFT", "SUBMITTED"].includes(status) ? (
        <button className={`${btn} border border-danger/30 text-danger hover:bg-danger/5`} disabled={!!busy} onClick={() => run("cancel", () => cancelPaymentRequest(id))}>
          {busy === "cancel" ? "…" : t("cancel")}
        </button>
      ) : null}
      <SignatureDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        onConfirm={onSign}
        title={`${dialog === "verify" ? t("verify") : t("markPaid")} — ${number}`}
        meanings={dialog === "verify" ? ["VERIFIED"] : ["PAID"]}
        meaningLabel={(m) => (m === "VERIFIED" ? t("meaningVerified") : t("meaningPaid"))}
        submitLabel={t("signSubmit")}
        requireReason={dialog === "paid"}
      />
    </div>
  );
}
