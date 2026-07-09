"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Truck, PackageCheck, X } from "lucide-react";
import { SignatureDialog } from "@/components/shared/SignatureDialog";
import { dispatchTransfer, receiveTransfer, cancelTransfer } from "@/app/(portal)/inventory/transfers/actions";

/** Dispatch (ISSUED sig) → in transit → receive (RECEIVED sig); drafts can be cancelled. */
export function TransferDetailActions({ id, status, canAct }: { id: string; status: string; canAct: boolean }) {
  const t = useTranslations("trf");
  const fmtErr = useActionError();
  const router = useRouter();
  const [mode, setMode] = useState<"dispatch" | "receive" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!canAct || (status !== "DRAFT" && status !== "IN_TRANSIT")) return null;

  async function cancel() {
    setError(null);
    setBusy(true);
    try {
      await cancelTransfer(id);
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
          <button type="button" onClick={() => setMode("dispatch")} className="flex items-center gap-1.5 rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
            <Truck className="h-4 w-4" /> {t("dispatch")}
          </button>
          <button type="button" disabled={busy} onClick={cancel} className="btn-outline flex items-center gap-1.5">
            <X className="h-4 w-4" /> {t("cancel")}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setMode("receive")} className="flex items-center gap-1.5 rounded-lg bg-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
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
          const act = mode === "dispatch" ? dispatchTransfer : receiveTransfer;
          await act({ id, password: p.password });
          setMode(null);
          router.refresh();
        }}
      />
    </div>
  );
}
