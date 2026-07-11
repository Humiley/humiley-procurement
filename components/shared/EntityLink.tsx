import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Document-number link that always links to the document (spec §22.3 <EntityLink>).
 * Rendered in the app font (Poppins) with tabular figures so codes align like monospace
 * while staying consistent with every other cell — navy + semibold for emphasis. Inherits
 * the surrounding text size so it never looks larger/smaller than its row.
 */
export function EntityLink({
  href,
  number,
  className,
}: {
  href: string;
  number: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "font-semibold text-navy tabular-nums whitespace-nowrap transition hover:underline",
        className,
      )}
    >
      {number}
    </Link>
  );
}
