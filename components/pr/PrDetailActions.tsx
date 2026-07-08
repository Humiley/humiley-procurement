"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Send, Undo2, XCircle, Pencil, Loader2 } from "lucide-react";
import { submitPr, recallPr, cancelPr } from "@/app/(portal)/requisitions/actions";

export function PrDetailActions({
  id,
  status,
  isOwner,
  canRecall,
}: {
  id: string;
  status: string;
  isOwner: boolean;
  canRecall: boolean;
}) {
  const t = useTranslations("pr");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(key: string, fn: () => Promise<unknown>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setError(null);
    setBusy(key);
    try {
      await fn();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(null);
    }
  }

  if (!isOwner) return null;

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && (
          <>
            <button className="btn-outline" onClick={() => router.push(`/requisitions/${id}/edit`)}>
              <Pencil className="h-4 w-4" /> {t("edit")}
            </button>
            <button
              className="btn-primary"
              onClick={() => run("submit", () => submitPr(id))}
              disabled={!!busy}
            >
              {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("submit")}
            </button>
          </>
        )}
        {status === "SUBMITTED" && canRecall && (
          <button className="btn-outline" onClick={() => run("recall", () => recallPr(id))} disabled={!!busy}>
            {busy === "recall" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            {t("recall")}
          </button>
        )}
        {(status === "DRAFT" || status === "SUBMITTED") && (
          <button
            className="btn-ghost text-danger"
            onClick={() => run("cancel", () => cancelPr(id), t("cancelConfirm"))}
            disabled={!!busy}
          >
            <XCircle className="h-4 w-4" /> {t("cancelPr")}
          </button>
        )}
      </div>
      {error && <p className="text-xs font-medium text-danger">{error}</p>}
    </div>
  );
}
