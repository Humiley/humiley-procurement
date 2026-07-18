import { useTranslations } from "next-intl";
import { Check, X, Clock, RotateCcw, PenLine } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatVnDateTime } from "@/lib/dates";

export type TimelineStep = {
  level: number;
  roleLabel: string; // e.g. "Review · Department Manager"
  approverName?: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED";
  actedAt?: string | Date | null;
  signatureMeaning?: string | null;
  slaDueAt?: string | Date | null;
  comment?: string | null;
};

const ICON = {
  APPROVED: { Icon: Check, ring: "bg-emerald text-white" },
  REJECTED: { Icon: X, ring: "bg-danger text-white" },
  RETURNED: { Icon: RotateCcw, ring: "bg-warning text-white" },
  PENDING: { Icon: Clock, ring: "bg-grey/20 text-grey" },
} as const;

/**
 * Approval + signature timeline (spec §22.3 <ApprovalTimeline>) — used by every module.
 */
export function ApprovalTimeline({ steps }: { steps: TimelineStep[] }) {
  const t = useTranslations("approvals");
  if (steps.length === 0) {
    return <p className="text-sm text-grey">{t("noSteps")}</p>;
  }
  return (
    <ol className="relative space-y-6 border-l-2 border-line pl-6">
      {steps.map((s, i) => {
        const { Icon, ring } = ICON[s.status];
        const overdue =
          s.status === "PENDING" && s.slaDueAt && new Date(s.slaDueAt) < new Date();
        return (
          <li key={i} className="relative">
            <span
              className={cn(
                "absolute -left-[33px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white",
                ring,
              )}
            >
              <Icon className="h-3.5 w-3.5" />
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span className="text-sm font-semibold text-body">
                {s.level >= 1 && s.level <= 3 ? t(`level${s.level}`) : s.roleLabel}
              </span>
              {s.approverName && <span className="text-sm text-grey">· {s.approverName}</span>}
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-grey">
              {s.actedAt && <span>{formatVnDateTime(s.actedAt)}</span>}
              {s.signatureMeaning && (
                <span className="inline-flex items-center gap-1 text-navy">
                  <PenLine className="h-3 w-3" /> {s.signatureMeaning}
                </span>
              )}
              {overdue && <span className="font-medium text-danger">{t("slaOverdue")}</span>}
              {!s.actedAt && s.slaDueAt && !overdue && (
                <span>{t("dueBy", { date: formatVnDateTime(s.slaDueAt) })}</span>
              )}
            </div>
            {s.comment && <p className="mt-1 text-sm text-body/80">“{s.comment}”</p>}
          </li>
        );
      })}
    </ol>
  );
}
