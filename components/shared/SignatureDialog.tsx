"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { PenLine, X, Loader2 } from "lucide-react";

export type SignaturePayload = {
  password: string;
  meaning: string;
  reason: string;
};

/**
 * The §19 signing ceremony (spec §22.3 <SignatureDialog>) — one component reused for every
 * signature (PR/PO/payment/etc.). Collects password re-auth + meaning + reason and hands them
 * to `onConfirm`. The cryptographic snapshot/hash-chain lives in lib/esign/sign.ts (Phase 4);
 * this dialog only gathers the ceremony inputs. Fully bilingual via the `esign` namespace.
 *
 * Accessible modal: role=dialog + aria-modal, focus moves to the password field on open and
 * back to the trigger on close, Tab is trapped, Enter submits, Escape cancels, body scroll
 * locks, and errors are announced via role=alert. `context` shows WHAT is being signed
 * (doc number, amount, payee) so the signer is never signing blind.
 */
export function SignatureDialog({
  open,
  onClose,
  onConfirm,
  title,
  context,
  meanings = ["APPROVED", "REVIEWED", "AUTHORED", "VERIFIED"],
  meaningLabel = (m) => m,
  submitLabel,
  requireReason = false,
  reasonLabel,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: SignaturePayload) => Promise<void> | void;
  title?: string;
  /** What is being signed — document number, amount, payee. Shown prominently. */
  context?: string;
  meanings?: string[];
  meaningLabel?: (m: string) => string;
  submitLabel?: string;
  requireReason?: boolean;
  /** Override the reason-field label (e.g. "Bank / payment reference" for payment execution). */
  reasonLabel?: string;
}) {
  const t = useTranslations("esign");
  const uid = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [password, setPassword] = useState("");
  const [meaning, setMeaning] = useState(meanings[0] ?? "APPROVED");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);
  busyRef.current = busy;

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    passwordRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) {
        e.stopPropagation();
        onClose();
      } else if (e.key === "Tab" && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables.length) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = "";
      restoreRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  async function submit() {
    setError(null);
    if (!password) return setError(t("errPassword"));
    if (requireReason && !reason.trim()) return setError(t("errReason"));
    setBusy(true);
    try {
      await onConfirm({ password, meaning, reason: reason.trim() });
      setPassword("");
      setReason("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,56,102,0.45)] p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        className="card max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl p-7"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={`${uid}-title`} className="flex items-center gap-2 text-base font-semibold text-navy">
            <PenLine className="h-4 w-4" /> {title ?? t("title")}
          </h2>
          <button className="btn-ghost" onClick={onClose} aria-label={t("close")} disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {context ? (
          <p className="mb-4 rounded-lg border border-navy/15 bg-navy/5 px-3 py-2 text-sm text-body">
            <span className="mr-1 text-xs font-semibold uppercase tracking-wide text-grey">{t("signing")}:</span>
            <span className="font-semibold text-navy">{context}</span>
          </p>
        ) : null}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void submit();
          }}
          className="space-y-3"
        >
          <div>
            <label className="label" htmlFor={`${uid}-meaning`}>{t("meaning")}</label>
            <select
              id={`${uid}-meaning`}
              className="field"
              value={meaning}
              onChange={(e) => setMeaning(e.target.value)}
            >
              {meanings.map((m) => (
                <option key={m} value={m}>
                  {meaningLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-reason`}>
              {reasonLabel ?? (requireReason ? t("reason") : t("reasonOptional"))}
            </label>
            <textarea
              id={`${uid}-reason`}
              className="field min-h-[64px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div>
            <label className="label" htmlFor={`${uid}-password`}>{t("password")}</label>
            <input
              id={`${uid}-password`}
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-grey">{t("note")}</p>
          </div>
          {error && (
            <p role="alert" className="text-sm font-medium text-danger">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </button>
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {submitLabel ?? t("submit")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
