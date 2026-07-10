"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Play, Ban } from "lucide-react";
import { activateContract, terminateContract } from "@/app/(portal)/contracts/actions";
import { act } from "@/lib/act";
import { toast } from "@/components/shared/Toaster";

/** DRAFT → activate; ACTIVE → terminate (irreversible — confirmed first). */
export function ContractDetailActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("contracts");
  const tc = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "DRAFT" && status !== "ACTIVE") return null;

  async function run(fn: (id: string) => Promise<unknown>, confirmFirst = false) {
    if (confirmFirst && !window.confirm(tc("confirmIrreversible"))) return;
    setError(null);
    setBusy(true);
    try {
      act(await fn(id));
      toast(tc("done"));
      router.refresh();
    } catch (e) {
      setError(fmtErr(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {status === "DRAFT" ? (
        <button type="button" disabled={busy} onClick={() => run(activateContract)} className="btn-emerald">
          <Play className="h-4 w-4" /> {t("activate")}
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => run(terminateContract, true)} className="btn-danger">
          <Ban className="h-4 w-4" /> {t("terminate")}
        </button>
      )}
      {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
