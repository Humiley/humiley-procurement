import Link from "next/link";
import { cn } from "@/lib/cn";

/**
 * Document-number chip that always links to the document (spec §22.3 <EntityLink>).
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
        "inline-flex items-center rounded border border-navy/20 bg-navy/5 px-1.5 py-0.5 font-mono text-[11px] font-bold text-navy transition hover:bg-navy/10",
        className,
      )}
    >
      {number}
    </Link>
  );
}
