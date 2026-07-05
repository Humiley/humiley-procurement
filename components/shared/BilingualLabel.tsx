import { cn } from "@/lib/cn";

/**
 * Bilingual label (spec §10 / §22.3): English primary, Vietnamese italic-grey secondary —
 * NEVER reversed. `inline` renders "EN · vn"; default stacks them.
 */
export function BilingualLabel({
  en,
  vn,
  inline = false,
  className,
}: {
  en: string;
  vn?: string | null;
  inline?: boolean;
  className?: string;
}) {
  if (!vn) return <span className={className}>{en}</span>;
  if (inline) {
    return (
      <span className={className}>
        {en} <span className="italic text-grey">· {vn}</span>
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col leading-tight", className)}>
      <span>{en}</span>
      <span className="text-xs italic text-grey">{vn}</span>
    </span>
  );
}
