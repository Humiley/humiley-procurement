import { cn } from "@/lib/cn";

/**
 * Render a VND money value (spec §22.3). Client-safe: accepts an already-serialized string
 * (from lib/money.decToString) or number — never a raw Prisma Decimal — and formats with Intl.
 */
const fmt = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});

export function VndDisplay({
  value,
  className,
  muted,
}: {
  value: string | number | null | undefined;
  className?: string;
  muted?: boolean;
}) {
  if (value === null || value === undefined || value === "") {
    return <span className={cn("text-grey", className)}>—</span>;
  }
  const n = typeof value === "string" ? Number(value) : value;
  return (
    <span
      className={cn(
        "tabular-nums",
        muted ? "text-grey" : "font-medium text-body",
        className,
      )}
    >
      {Number.isFinite(n) ? fmt.format(n) : "—"}
    </span>
  );
}
