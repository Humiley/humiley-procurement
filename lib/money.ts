import { Prisma } from "@prisma/client";

/**
 * Money layer (spec §22.4). Prisma Decimal end-to-end; NEVER pass a raw Decimal to a Client
 * Component (not serializable). Serialize with `decToString` at the server boundary; format
 * for humans with `formatVnd`.
 *
 * Precision: amounts Decimal(18,2), qty Decimal(18,4), fx Decimal(18,6).
 */
export type DecimalValue = Prisma.Decimal.Value;

export const ZERO = new Prisma.Decimal(0);

export function dec(v: DecimalValue): Prisma.Decimal {
  return new Prisma.Decimal(v ?? 0);
}

/** Serialize a Decimal (or null) to a fixed-scale string for Client Components / JSON. */
export function decToString(
  v: Prisma.Decimal | null | undefined,
  scale = 2,
): string | null {
  if (v === null || v === undefined) return null;
  return new Prisma.Decimal(v).toFixed(scale);
}

/** Sum a list of Decimal-ish values. */
export function sumDec(values: Array<DecimalValue | null | undefined>): Prisma.Decimal {
  return values.reduce<Prisma.Decimal>(
    (acc, v) => acc.plus(v == null ? 0 : new Prisma.Decimal(v)),
    ZERO,
  );
}

/** line amount = qty × unitPrice, rounded to `scale` decimals (default money 2dp). */
export function lineAmount(
  qty: DecimalValue,
  unitPrice: DecimalValue,
  scale = 2,
): Prisma.Decimal {
  return new Prisma.Decimal(qty).times(unitPrice).toDecimalPlaces(scale);
}

/** VAT amount from a base and a percent (e.g. 10). */
export function vatAmount(base: DecimalValue, pct: DecimalValue, scale = 2): Prisma.Decimal {
  return new Prisma.Decimal(base).times(new Prisma.Decimal(pct).div(100)).toDecimalPlaces(scale);
}

const vndFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0,
});
const plainFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

/** Format a VND money value for display, e.g. "1.234.567 ₫". Accepts Decimal, string or number. */
export function formatVnd(
  v: Prisma.Decimal | string | number | null | undefined,
  opts: { symbol?: boolean } = {},
): string {
  if (v === null || v === undefined) return "—";
  const n = new Prisma.Decimal(v).toNumber();
  return opts.symbol === false ? plainFmt.format(n) : vndFmt.format(n);
}

/** Format a quantity (up to 4dp, trailing zeros trimmed). */
export function formatQty(v: Prisma.Decimal | string | number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  const d = new Prisma.Decimal(v);
  return d.toDecimalPlaces(4).toNumber().toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** Parse a user-typed money string ("1.234.567" or "1234567") into a Decimal. */
export function parseVndInput(raw: string): Prisma.Decimal {
  const cleaned = raw.replace(/[^\d,-]/g, "").replace(/\./g, "").replace(",", ".");
  return new Prisma.Decimal(cleaned || 0);
}
