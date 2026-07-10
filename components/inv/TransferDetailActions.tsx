"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "@/components/shared/Toaster";
import { Truck, PackageCheck, X } from "lucide-react";
import { SignatureDialog } from "@/components/shared/SignatureDialog";
import { dispatchTransfer, receiveTransfer, cancelTransfer } from "@/app/(portal)/inventory/transfers/actions";
import { act } from "@/lib/act";

/** Dispatch (ISSUED sig) → in transit → receive (RECEIVED sig); drafts can be cancelled. */
export function TransferDetailActions({ id, status, canAct }: { id: string; status: string; canAct: boolean }) {
  const t = useTranslations("trf");
  const tc = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [mode, setMode] = useState<"dispatch" | "receive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canAct || (status !== "DRAFT" && status !== "IN_TRANSIT")) return null;

  async function cancel() {
    if (!window.confirm(tc("confirmIrreversible"))) return;
    setError(null);
    setBusy(true);
    try {
      act(await cancelTransfer(id));
      toast(tc("done"));
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {status === "DRAFT" ? (
        <>
          <button type="button" onClick={() => setMode("dispatch")} className="btn-primary">
            <Truck className="h-4 w-4" /> {t("dispatch")}
          </button>
          <button type="button" disabled={busy} onClick={cancel} className="btn-outline flex items-center gap-1.5">
            <X className="h-4 w-4" /> {t("cancel")}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setMode("receive")} className="btn-emerald">
          <PackageCheck className="h-4 w-4" /> {t("receive")}
        </button>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <SignatureDialog
        open={mode !== null}
        onClose={() => setMode(null)}
        title={mode === "dispatch" ? t("signDispatch") : t("signReceive")}
        meanings={mode === "dispatch" ? ["ISSUED"] : ["RECEIVED"]}
        meaningLabel={(m) => (m === "ISSUED" ? t("meaningDispatched") : t("meaningReceived"))}
        submitLabel={mode === "dispatch" ? t("dispatch") : t("receive")}
        onConfirm={async (p) => {
          const fn = mode === "dispatch" ? dispatchTransfer : receiveTransfer;
          act(await fn({ id, password: p.password }));   // unwrap {__err} — was swallowed by a shadowed local
          setMode(null);
          toast(tc("done"));
          router.refresh();
        }}
      />
    </div>
  );
}
