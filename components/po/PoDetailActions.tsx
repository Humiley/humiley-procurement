"use client";

import { useState, useTransition } from "react";
import { useActionError } from "@/lib/use-action-error";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { submitPo, sendPo, cancelPo, closePo } from "@/app/(portal)/purchase-orders/actions";
import { act } from "@/lib/act";
import { toast } from "@/components/shared/Toaster";

/** PO lifecycle actions (§8): submit for approval, send to vendor (emails the PDF), close, cancel. */
export function PoDetailActions({
  id,
  status,
  canManage,
}: {
  id: string;
  status: string;
  canManage: boolean;
}) {
  const t = useTranslations("po");
  const tc = useTranslations("common");
  const fmtErr = useActionError();
  const router = useRouter();
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      {error ? <span className="text-xs text-danger">{error}</span> : null}
      <a href={`/api/po/${id}/pdf`} target="_blank" rel="noopener" className={"btn-outline"}>
        {t("pdf")}
      </a>
      {canManage && status === "DRAFT" ? (
        <button className={"btn-primary"} disabled={!!busy} onClick={() => run("submit", () => submitPo(id))}>
          {busy === "submit" ? "…" : t("submit")}
        </button>
      ) : null}
      {canManage && status === "APPROVED" ? (
        <button className={"btn-emerald"} disabled={!!busy} onClick={() => run("send", () => sendPo(id))}>
          {busy === "send" ? "…" : t("send")}
        </button>
      ) : null}
      {canManage && ["SENT", "PARTIALLY_RECEIVED", "RECEIVED"].includes(status) ? (
        <button className={"btn-ghost"} disabled={!!busy} onClick={() => run("close", () => closePo(id), true)}>
          {busy === "close" ? "…" : t("close")}
        </button>
      ) : null}
      {canManage && ["DRAFT", "APPROVED", "SENT"].includes(status) ? (
        <button className={"btn-danger"} disabled={!!busy} onClick={() => run("cancel", () => cancelPo(id), true)}>
          {busy === "cancel" ? "…" : t("cancel")}
        </button>
      ) : null}
    </div>
  );
}
