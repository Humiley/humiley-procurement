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
    <div className="card flex items-center gap-4 p-4 transition hover:shadow-md">
      {Icon && (
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
            accent === "emerald" ? "bg-emerald/10 text-emerald" : "bg-navy/10 text-navy",
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        {/* long VND figures scale down instead of truncating — every digit stays visible */}
        <p
          className={cn(
            "font-bold leading-snug tabular-nums text-body",
            String(value).length > 11 ? "text-lg" : "text-2xl",
          )}
          title={String(value)}
        >
          {value}
        </p>
        <p className="truncate text-sm text-grey" title={label}>
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
