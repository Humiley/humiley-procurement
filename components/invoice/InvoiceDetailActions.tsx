"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/shared/Toaster";
import { SignatureDialog, type SignaturePayload } from "@/components/shared/SignatureDialog";
import { verifyInvoice, markInvoicePaid } from "@/app/(portal)/invoices/actions";
import { act } from "@/lib/act";

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
  const tc = useTranslations("common");
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "verify" | "paid" | "partial">(null);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  async function onSign(payload: SignaturePayload) {
    // errors propagate to SignatureDialog (shown inline, typed password kept) — was closing + discarding
    if (dialog === "verify") {
      act(await verifyInvoice({ invoiceId, password: payload.password, overrideComment: payload.reason }));
    } else {
      act(await markInvoicePaid({ invoiceId, password: payload.password, partial: dialog === "partial" }));
    }
    setDialog(null);
    toast(tc("done"));
    start(() => router.refresh());
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      {!verified ? (
        <button className={"btn-primary"} onClick={() => { setError(null); setDialog("verify"); }}>
          {matched ? t("verify") : t("verifyOverride")}
        </button>
      ) : null}
      {verified && paymentStatus !== "PAID" ? (
        <>
          <button className={"btn-emerald"} onClick={() => { setError(null); setDialog("paid"); }}>
            {t("markPaid")}
          </button>
          <button className={"btn-outline !border-emerald !text-emerald hover:!bg-emerald/5"} onClick={() => { setError(null); setDialog("partial"); }}>
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
