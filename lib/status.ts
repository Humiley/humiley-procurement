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

export const TONE_CLASSES: Record<Tone, string> = {
  navy: "bg-navy/10 text-navy ring-navy/20",
  emerald: "bg-emerald/10 text-emerald ring-emerald/25",
  grey: "bg-grey/10 text-grey ring-grey/20",
  red: "bg-danger/10 text-danger ring-danger/20",
  amber: "bg-warning/10 text-warning ring-warning/25",
};

/** "PARTIALLY_PAID" → "Partially paid" (fallback when no i18n label supplied). */
export function humanizeStatus(status: string): string {
  const words = status.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
