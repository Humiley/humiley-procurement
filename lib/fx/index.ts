import "server-only";
import { db } from "@/lib/db";

/** §20 FX — latest manual rate per currency (VND per 1 unit). VND itself is 1. */
export async function latestFxRate(currency: string): Promise<number> {
  const cur = currency.toUpperCase();
  if (cur === "VND") return 1;
  const row = await db.fxRate.findFirst({ where: { currency: cur }, orderBy: { rateDate: "desc" } });
  return row ? Number(row.rateToVnd) : 1;
}

export async function latestFxRates(): Promise<Record<string, number>> {
  const rows = await db.fxRate.findMany({ orderBy: { rateDate: "desc" } });
  const out: Record<string, number> = { VND: 1 };
  for (const r of rows) if (!(r.currency in out)) out[r.currency] = Number(r.rateToVnd);
  return out;
}
