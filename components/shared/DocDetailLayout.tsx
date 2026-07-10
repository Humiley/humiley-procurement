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
    <div className="space-y-[22px]">
      <Link href={backHref} className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="page-title">{title}</h1>
              {statusSlot}
            </div>
            {subtitle && <p className="mt-1 text-sm text-grey">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {metaSlot && <div className="mt-4 border-t border-line pt-4">{metaSlot}</div>}
      </div>

      <div className="card">
        {/* portal segmented tabs: soft-bg track, active tab = white + emerald */}
        <div className="border-b border-line p-3">
          <div className="inline-flex flex-wrap gap-1 rounded-[10px] bg-panel p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setActive(t.key)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-[7px] px-[15px] py-1.5 text-[13px] font-semibold transition",
                  t.key === current?.key
                    ? "bg-white text-emerald shadow-[0_1px_4px_rgba(0,0,0,0.1)]"
                    : "text-grey hover:text-body",
                )}
              >
                {t.label}
                {typeof t.count === "number" && (
                  <span className="rounded-full bg-navy/10 px-1.5 py-0.5 text-[11px] font-bold text-navy">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="p-6">{current?.content}</div>
      </div>
    </div>
  );
}
