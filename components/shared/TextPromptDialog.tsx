"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

/**
 * Accessible replacement for window.prompt() — used for compliance-critical
 * justifications (RFQ <3 vendors, award-not-lowest, vendor blacklist). Proper
 * modal semantics, Escape/Enter handling, required-text validation, and the
 * typed value survives a mis-click (prompt() lost it).
 */
export function TextPromptDialog({
  open,
  title,
  label,
  onClose,
  onConfirm,
  confirmLabel,
  danger = false,
}: {
  open: boolean;
  title: string;
  /** The question being answered, e.g. "Justification (required)". */
  label: string;
  onClose: () => void;
  onConfirm: (value: string) => void | Promise<void>;
  confirmLabel?: string;
  danger?: boolean;
}) {
  const t = useTranslations("common");
  const uid = useId();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    boxRef.current?.focus();
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
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
    setTouched(true);
    if (!value.trim() || busy) return;
    setBusy(true);
    try {
      await onConfirm(value.trim());
      setValue("");
      setTouched(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(22,56,102,0.45)] p-4">
      <div role="dialog" aria-modal="true" aria-labelledby={`${uid}-t`} className="card max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-xl p-7">
        <div className="mb-3 flex items-center justify-between">
          <h2 id={`${uid}-t`} className="text-base font-semibold text-navy">{title}</h2>
          <button className="btn-ghost" onClick={onClose} aria-label={t("close")} disabled={busy}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="space-y-3"
        >
          <div>
            <label className="label" htmlFor={`${uid}-v`}>{label}</label>
            <textarea
              id={`${uid}-v`}
              ref={boxRef}
              className="field min-h-[80px]"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={touched && !value.trim()}
            />
            {touched && !value.trim() ? (
              <p role="alert" className="mt-1 text-xs font-medium text-danger">{t("required")}</p>
            ) : null}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={onClose} disabled={busy}>
              {t("cancel")}
            </button>
            <button type="submit" className={danger ? "btn-primary !bg-danger" : "btn-primary"} disabled={busy}>
              {confirmLabel ?? t("confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
