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
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-bold",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label ?? humanizeStatus(status)}
    </span>
  );
}
