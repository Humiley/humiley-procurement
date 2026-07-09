"use client";

import { useState } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Play, Ban } from "lucide-react";
import { activateContract, terminateContract } from "@/app/(portal)/contracts/actions";

/** DRAFT → activate; ACTIVE → terminate. */
export function ContractDetailActions({ id, status }: { id: string; status: string }) {
  const t = useTranslations("contracts");
  const fmtErr = useActionError();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "DRAFT" && status !== "ACTIVE") return null;

  async function act(fn: (id: string) => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await fn(id);
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
        <button type="button" disabled={busy} onClick={() => act(activateContract)} className="flex items-center gap-1.5 rounded-lg bg-emerald px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          <Play className="h-4 w-4" /> {t("activate")}
        </button>
      ) : (
        <button type="button" disabled={busy} onClick={() => act(terminateContract)} className="flex items-center gap-1.5 rounded-lg border border-danger/40 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/5 disabled:opacity-50">
          <Ban className="h-4 w-4" /> {t("terminate")}
        </button>
      )}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
