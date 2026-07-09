"use client";

import { useState, useTransition } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { verifyInvoice, markInvoicePaid } from "@/app/(portal)/invoices/actions";

/** §9 + §19: verify the 3-way match (VERIFIED) and record payment (PAID) — both signing ceremonies. */
export function InvoiceDetailActions({
  invoiceId,
  invoiceNumber,
  matched,
  verified,
  paymentStatus,
}: {
  invoiceId: string;
  invoiceNumber: string;
  matched: boolean;
  verified: boolean;
  paymentStatus: string;
}) {
  const t = useTranslations("invoice");
  const fmtErr = useActionError();
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "verify" | "paid" | "partial">(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function onSign(payload: SignaturePayload) {
    try {
      if (dialog === "verify") {
        await verifyInvoice({ invoiceId, password: payload.password, overrideComment: payload.reason });
      } else {
        await markInvoicePaid({ invoiceId, password: payload.password, partial: dialog === "partial" });
      }
      setDialog(null);
      start(() => router.refresh());
    } catch (e) {
      setDialog(null);
      setError(fmtErr(e));
    }
  }

  const btn = "rounded-lg px-3 py-1.5 text-sm font-semibold";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!verified ? (
        <button className={`${btn} bg-navy text-white hover:opacity-90`} onClick={() => { setError(null); setDialog("verify"); }}>
          {matched ? t("verify") : t("verifyOverride")}
        </button>
      ) : null}
      {verified && paymentStatus !== "PAID" ? (
        <>
          <button className={`${btn} bg-emerald text-white hover:opacity-90`} onClick={() => { setError(null); setDialog("paid"); }}>
            {t("markPaid")}
          </button>
          <button className={`${btn} border border-emerald/40 text-emerald hover:bg-emerald/5`} onClick={() => { setError(null); setDialog("partial"); }}>
            {t("markPartial")}
          </button>
        </>
      ) : null}
      <SignatureDialog
        open={!!dialog}
        onClose={() => setDialog(null)}
        onConfirm={onSign}
        title={`${dialog === "verify" ? t("verify") : t("markPaid")} — ${invoiceNumber}`}
        meanings={dialog === "verify" ? ["VERIFIED"] : ["PAID"]}
        meaningLabel={(m) => (m === "VERIFIED" ? t("meaningVerified") : t("meaningPaid"))}
        submitLabel={t("signSubmit")}
        requireReason={dialog === "verify" && !matched}
      />
    </div>
  );
}
