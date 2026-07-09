import { formatInTimeZone, toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Date layer (spec §22.4). Display in Asia/Ho_Chi_Minh; canonicalize to ISO-UTC for hashing.
 */
export const TZ = "Asia/Ho_Chi_Minh";

/** Format a date/time in Vietnam time, e.g. "06/07/2026 14:30". */
export function formatVnDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return formatInTimeZone(new Date(d), TZ, "dd/MM/yyyy HH:mm");
}

/** Format a date (no time) in Vietnam time, e.g. "06/07/2026". */
export function formatVnDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return formatInTimeZone(new Date(d), TZ, "dd/MM/yyyy");
}

/** ISO string in Vietnam time (e.g. for filenames / labels). */
export function isoVn(d: Date | string): string {
  return formatInTimeZone(new Date(d), TZ, "yyyy-MM-dd'T'HH:mm:ssXXX");
}

/** Plain calendar date in Vietnam time, e.g. "2026-07-09" — for CSV/reports/date inputs.
 *  NEVER use toISOString().slice(0,10) for display: on a +07 server, local-midnight dates
 *  render as the PREVIOUS day. This helper is timezone-independent. */
export function ymdVn(d: Date | string | null | undefined): string {
  if (!d) return "";
  return formatInTimeZone(new Date(d), TZ, "yyyy-MM-dd");
}

/** Date + minutes in Vietnam time, e.g. "2026-07-09 14:30". */
export function ymdHmVn(d: Date | string | null | undefined): string {
  if (!d) return "";
  return formatInTimeZone(new Date(d), TZ, "yyyy-MM-dd HH:mm");
}

/** Canonical ISO-UTC string (used in signature snapshot hashing). */
export function isoUtc(d: Date | string): string {
  return new Date(d).toISOString();
}

/** Start of a VN calendar day, returned as a UTC Date. */
export function startOfVnDay(d: Date = new Date()): Date {
  const zoned = toZonedTime(d, TZ);
  zoned.setHours(0, 0, 0, 0);
  return fromZonedTime(zoned, TZ);
}

/** Add days to a date (returns a new Date). */
export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** Whole days between two dates (b - a), floored. */
export function daysBetween(a: Date | string, b: Date | string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(ms / 86_400_000);
}

/** Fiscal year a document belongs to (VN calendar year of its date, in VN time). */
export function fiscalYearOf(d: Date | string): number {
  return Number(formatInTimeZone(new Date(d), TZ, "yyyy"));
}

/** Current fiscal year in VN — calendar-year based (Jan–Dec). */
export function currentFiscalYear(now: Date = new Date()): number {
  return Number(formatInTimeZone(now, TZ, "yyyy"));
}
