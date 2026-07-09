"use client";

import { useState } from "react";
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
 */
export function SignatureDialog({
  open,
  onClose,
  onConfirm,
  title,
  meanings = ["APPROVED", "REVIEWED", "AUTHORED", "VERIFIED"],
  meaningLabel = (m) => m,
  submitLabel,
  requireReason = false,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (payload: SignaturePayload) => Promise<void> | void;
  title?: string;
  meanings?: string[];
  meaningLabel?: (m: string) => string;
  submitLabel?: string;
  requireReason?: boolean;
}) {
  const t = useTranslations("esign");
  const [password, setPassword] = useState("");
  const [meaning, setMeaning] = useState(meanings[0] ?? "APPROVED");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-body/40 p-4">
      <div className="card w-full max-w-md p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-navy">
            <PenLine className="h-4 w-4" /> {title ?? t("title")}
          </h2>
          <button className="btn-ghost" onClick={onClose} aria-label={t("close")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">{t("meaning")}</label>
            <select className="field" value={meaning} onChange={(e) => setMeaning(e.target.value)}>
              {meanings.map((m) => (
                <option key={m} value={m}>
                  {meaningLabel(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">{requireReason ? t("reason") : t("reasonOptional")}</label>
            <textarea
              className="field min-h-[64px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <div>
            <label className="label">{t("password")}</label>
            <input
              type="password"
              autoComplete="current-password"
              className="field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="mt-1 text-xs text-grey">{t("note")}</p>
          </div>
          {error && <p className="text-sm font-medium text-danger">{error}</p>}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {submitLabel ?? t("submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
