"use client";

import { useId, useRef } from "react";
import { cn } from "@/lib/cn";

/** Caret index in `text` that sits just after `digitCount` digits. */
function caretForDigitCount(text: string, digitCount: number): number {
  let pos = 0;
  let seen = 0;
  while (pos < text.length && seen < digitCount) {
    if (/\d/.test(text[pos])) seen += 1;
    pos += 1;
  }
  return pos;
}

/**
 * VND money input (spec §22.3). Value is a plain integer-string of dong (no separators);
 * the field shows grouped thousands. Server re-parses/re-computes with lib/money (Decimal).
 * Caret is preserved across reformatting: we count the digits left of the caret in the raw
 * input, let React re-render the formatted text, then restore the caret after the same
 * digit count (mid-string edits no longer jump the caret to the end).
 */
export function MoneyInput({
  value,
  onChange,
  id,
  name,
  placeholder = "0",
  disabled,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (raw: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
}) {
  const auto = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const digits = (value ?? "").replace(/\D/g, "");
  const display = digits ? Number(digits).toLocaleString("vi-VN") : "";
  return (
    <div className={cn("relative", className)}>
      <input
        ref={inputRef}
        id={id ?? auto}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        aria-label={ariaLabel}
        className="field pr-8 text-right tabular-nums"
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        onChange={(e) => {
          const el = e.target;
          const caret = el.selectionStart ?? el.value.length;
          const digitsLeft = el.value.slice(0, caret).replace(/\D/g, "").length;
          onChange(el.value.replace(/\D/g, ""));
          // After React commits the reformatted value (or restores it when the
          // edit was rejected), put the caret back after the same digit count.
          requestAnimationFrame(() => {
            const node = inputRef.current;
            if (!node || document.activeElement !== node) return;
            const pos = caretForDigitCount(node.value, digitsLeft);
            node.setSelectionRange(pos, pos);
          });
        }}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-grey">
        ₫
      </span>
    </div>
  );
}
