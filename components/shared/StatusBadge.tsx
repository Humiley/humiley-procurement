import { cn } from "@/lib/cn";
import { statusTone, TONE_CLASSES, humanizeStatus } from "@/lib/status";

/**
 * One enum→color/label pill for ALL document statuses (spec §22.3). Pass a translated `label`
 * (e.g. t(`status.${s}`)) for i18n; otherwise the status token is humanized.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const tone = statusTone(status);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label ?? humanizeStatus(status)}
    </span>
  );
}
