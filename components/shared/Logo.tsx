import { cn } from "@/lib/cn";

/**
 * Humiley wordmark (spec §10). Inline SVG so it never depends on a binary asset and always
 * renders on-brand: navy tile + white "H" + emerald underline on light backgrounds; inverted
 * for the navy sidebar. Never stretch or recolor beyond these two variants.
 */
export function Logo({
  variant = "navy",
  showWordmark = true,
  className,
}: {
  variant?: "navy" | "white";
  showWordmark?: boolean;
  className?: string;
}) {
  const tile = variant === "white" ? "#FFFFFF" : "#205090";
  const letter = variant === "white" ? "#205090" : "#FFFFFF";
  const wordmark = variant === "white" ? "#FFFFFF" : "#205090";
  const accent = "#00B060";
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg width="30" height="30" viewBox="0 0 32 32" role="img" aria-label="Humiley">
        <rect x="1" y="1" width="30" height="30" rx="7" fill={tile} />
        <rect x="9" y="8" width="3" height="16" fill={letter} />
        <rect x="20" y="8" width="3" height="16" fill={letter} />
        <rect x="9" y="14.5" width="14" height="3" fill={letter} />
        <rect x="9" y="26" width="14" height="2" rx="1" fill={accent} />
      </svg>
      {showWordmark && (
        <span className="text-lg font-bold tracking-tight" style={{ color: wordmark }}>
          Humiley
        </span>
      )}
    </span>
  );
}
