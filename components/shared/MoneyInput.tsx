"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/**
 * VND money input (spec §22.3). Value is a plain integer-string of dong (no separators);
 * the field shows grouped thousands. Server re-parses/re-computes with lib/money (Decimal).
 */
export function MoneyInput({
  value,
  onChange,
  id,
  name,
  placeholder = "0",
  disabled,
  className,
}: {
  value: string;
  onChange: (raw: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const auto = useId();
  const digits = (value ?? "").replace(/\D/g, "");
  const display = digits ? Number(digits).toLocaleString("vi-VN") : "";
  return (
    <div className={cn("relative", className)}>
      <input
        id={id ?? auto}
        name={name}
        inputMode="numeric"
        autoComplete="off"
        className="field pr-8 text-right tabular-nums"
        placeholder={placeholder}
        value={display}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-grey">
        ₫
      </span>
    </div>
  );
}
