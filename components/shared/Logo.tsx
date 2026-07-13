import Image from "next/image";
import { cn } from "@/lib/cn";
import { withBase } from "@/lib/base-path";

/**
 * The official Humiley Engineering & Solutions logo — the SAME master files the
 * Humiley Portal (timekeeping) renders, copied from its static/brand/, so the
 * procurement app reads as one product family. Full-colour navy wordmark on light
 * backgrounds, white wordmark on the navy sidebar; square H-mark when there is no
 * room for the wordmark. Never stretch, recolor, or re-typeset (HML-BG-001).
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
  // Serve the raw PNG straight from /public rather than through the Next image optimizer:
  //  • `unoptimized` — the brand marks are already tiny (~20 KB) and fixed, so the optimizer buys
  //    nothing and was a failure point (a cold/​restarting dev optimizer rendered a broken image,
  //    e.g. inside the portal iframe).
  //  • `withBase()` — under the portal the app has basePath "/procurement", and Next does NOT
  //    auto-prefix that onto an unoptimized image's raw src, so we add it (else it 404s at /brand/…).
  if (!showWordmark) {
    return (
      <Image
        src={withBase(variant === "white" ? "/brand/H-mark-white.png" : "/brand/H-mark-color.png")}
        alt="Humiley"
        width={36}
        height={34}
        className={cn("h-9 w-auto", className)}
        priority
        unoptimized
      />
    );
  }
  return (
    <Image
      src={withBase(variant === "white" ? "/brand/Humiley_Logo_White.png" : "/brand/Humiley_Logo_Navy.png")}
      alt="Humiley Engineering & Solutions"
      width={500}
      height={175}
      className={cn("h-9 w-auto", className)}
      priority
      unoptimized
    />
  );
}
