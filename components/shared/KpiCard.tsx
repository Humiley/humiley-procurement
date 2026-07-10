import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

export function KpiCard({
  label,
  value,
  icon: Icon,
  href,
  accent = "navy",
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  href?: string;
  accent?: "navy" | "emerald";
}) {
  const inner = (
    <div className="card flex items-center gap-[14px] px-6 py-[22px] transition hover:shadow-card-hover">
      {Icon && (
        <span
          className={cn(
            "flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-xl",
            accent === "emerald" ? "bg-emerald/[0.12] text-emerald" : "bg-navy/[0.12] text-navy",
          )}
        >
          <Icon className="h-[22px] w-[22px]" />
        </span>
      )}
      <div className="min-w-0">
        {/* portal .kpi-value: fluid clamp + wrap so a long ₫ figure auto-scales and every digit
            stays visible instead of spilling the card (navy, weight 600, line-height 1). */}
        <p
          className="tabular-nums text-[clamp(24px,7vw,34px)] font-semibold leading-none text-navy [overflow-wrap:anywhere]"
          title={String(value)}
        >
          {value}
        </p>
        <p className="mt-1 truncate text-xs font-medium text-grey" title={label}>
          {label}
        </p>
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="rounded-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/50 focus-visible:ring-offset-2">
      {inner}
    </Link>
  ) : (
    inner
  );
}
