import Image from "next/image";
import { cn } from "@/lib/cn";

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
  if (!showWordmark) {
    return (
      <Image
        src={variant === "white" ? "/brand/H-mark-white.png" : "/brand/H-mark-color.png"}
        alt="Humiley"
        width={36}
        height={34}
        className={cn("h-9 w-auto", className)}
        priority
      />
    );
  }
  return (
    <Image
      src={variant === "white" ? "/brand/Humiley_Logo_White.png" : "/brand/Humiley_Logo_Navy.png"}
      alt="Humiley Engineering & Solutions"
      width={500}
      height={175}
      className={cn("h-9 w-auto", className)}
      priority
    />
  );
}
