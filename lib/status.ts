/**
 * Status → visual tone mapping (spec §22.3 <StatusBadge>). Client-safe (no Prisma import).
 * navy = in progress · emerald = approved/done · grey = draft · red = rejected · amber = warning.
 */
export type Tone = "navy" | "emerald" | "grey" | "red" | "amber";

const RED = new Set([
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
  "FAILED",
  "OVERDUE",
  "BLOCKED",
  "TAMPERED",
]);
const EMERALD = new Set([
  "APPROVED",
  "PAID",
  "MATCHED",
  "DONE",
  "COMPLETED",
  "CLOSED",
  "ACCEPTED",
  "ACTIVE",
  "POSTED",
  "RECEIVED",
  "ISSUED",
  "FULLY_RECEIVED",
  "FULLY_INVOICED",
]);
const GREY = new Set(["DRAFT", "INACTIVE", "ARCHIVED", "NEW"]);
const AMBER = new Set([
  "RETURNED",
  "PARTIALLY_PAID",
  "PARTIALLY_RECEIVED",
  "PARTIALLY_INVOICED",
  "ON_HOLD",
  "PENDING_INFO",
  "WARNING",
  "IN_TRANSIT",
  "EXCEPTION",
]);

export function statusTone(status: string): Tone {
  const s = status.toUpperCase();
  if (RED.has(s)) return "red";
  if (EMERALD.has(s)) return "emerald";
  if (GREY.has(s)) return "grey";
  if (AMBER.has(s)) return "amber";
  return "navy"; // SUBMITTED, PENDING, IN_REVIEW, OPEN, APPROVING, …
}

// Portal badge tones — exact tint/ink pairs (soft-100 bg, dark-800 ink), never bright text.
export const TONE_CLASSES: Record<Tone, string> = {
  navy: "bg-navy/10 text-navy",
  emerald: "bg-[#D1FAE5] text-[#065F46]",
  grey: "bg-grey/10 text-grey",
  red: "bg-[#FEE2E2] text-[#991B1B]",
  amber: "bg-[#FEF3C7] text-[#92400E]",
};

/** "PARTIALLY_PAID" → "Partially paid" (fallback when no i18n label supplied). */
export function humanizeStatus(status: string): string {
  const words = status.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
