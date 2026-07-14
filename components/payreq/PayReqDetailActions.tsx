"use client";

import { useState, useTransition } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { submitPaymentRequest, verifyPaymentRequest, markPaymentRequestPaid, cancelPaymentRequest } from "@/app/(portal)/payment-requests/actions";
import { act } from "@/lib/act";
import { toast } from "@/components/shared/Toaster";

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
  const tc = useTranslations("common");
  const te = useTranslations("esign");
  const fmtErr = useActionError();
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "verify" | "paid">(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function run(kind: string, fn: () => Promise<unknown>, confirmFirst = false) {
    if (confirmFirst && !window.confirm(tc("confirmIrreversible"))) return;
    setError(null);
    setBusy(kind);
    try {
      act(await fn());
      toast(tc("done"));
      start(() => router.refresh());
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(null);
    }
  }

  async function onSign(payload: SignaturePayload) {
    // errors propagate to the SignatureDialog, which shows them inline and keeps
    // the typed password/reference — closing here used to throw the input away
    if (dialog === "verify") act(await verifyPaymentRequest({ id, password: payload.password, comment: payload.reason, imageData: payload.imageData }));
    else act(await markPaymentRequestPaid({ id, password: payload.password, paymentRef: payload.reason || "", imageData: payload.imageData }));
    setDialog(null);
    toast(tc("done"));
    start(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      <a href={`/api/payment-request/${id}/pdf`} target="_blank" rel="noopener" className={"btn-outline"}>
        {t("pdf")}
      </a>
      {isRequester && status === "DRAFT" ? (
        <button className={"btn-primary"} disabled={!!busy} onClick={() => run("submit", () => submitPaymentRequest(id))}>
          {busy === "submit" ? "…" : t("submit")}
        </button>
      ) : null}
      {isAccountant && status === "SUBMITTED" && !verified ? (
        <button className={"btn-primary"} onClick={() => { setError(null); setDialog("verify"); }}>
          {t("verify")}
        </button>
      ) : null}
      {isAccountant && status === "APPROVED" ? (
        <button className={"btn-emerald"} onClick={() => { setError(null); setDialog("paid"); }}>
          {t("markPaid")}
        </button>
      ) : null}
      {(isRequester || isAccountant) && ["DRAFT", "SUBMITTED"].includes(status) ? (
        <button className={"btn-danger"} disabled={!!busy} onClick={() => run("cancel", () => cancelPaymentRequest(id), true)}>
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
        reasonLabel={dialog === "paid" ? te("bankRef") : undefined}
        context={number}
      />
    </div>
  );
}
