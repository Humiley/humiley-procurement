"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/cn";

export type DetailTab = {
  key: string;
  label: string;
  content: React.ReactNode;
  count?: number;
};

/**
 * Document detail scaffold (spec §22.3 <DocDetailLayout>): header card + tabs
 * (Details / Approvals & Signatures / Attachments / Audit) + an action bar driven by the
 * transitions the current user is allowed to perform.
 */
export function DocDetailLayout({
  backHref,
  backLabel = "Back",
  title,
  subtitle,
  statusSlot,
  metaSlot,
  actions,
  tabs,
}: {
  backHref: string;
  backLabel?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  statusSlot?: React.ReactNode;
  metaSlot?: React.ReactNode;
  actions?: React.ReactNode;
  tabs: DetailTab[];
}) {
  const [active, setActive] = useState(tabs[0]?.key);
  const current = tabs.find((t) => t.key === active) ?? tabs[0];

  return (
    <div className="space-y-4">
      <Link href={backHref} className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-[22px] font-bold text-navy">{title}</h1>
              {statusSlot}
            </div>
            {subtitle && <p className="mt-1 text-sm text-grey">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {metaSlot && <div className="mt-4 border-t border-line pt-4">{metaSlot}</div>}
      </div>

      <div className="card">
        <div className="flex flex-wrap gap-1 border-b border-line px-2">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={cn(
                "relative px-4 py-3 text-sm font-medium transition",
                t.key === current?.key
                  ? "text-navy"
                  : "text-grey hover:text-body",
              )}
            >
              {t.label}
              {typeof t.count === "number" && (
                <span className="ml-1.5 rounded-full bg-panel px-1.5 py-0.5 text-xs text-grey">
                  {t.count}
                </span>
              )}
              {t.key === current?.key && (
                <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-emerald" />
              )}
            </button>
          ))}
        </div>
        <div className="p-5">{current?.content}</div>
      </div>
    </div>
  );
}
