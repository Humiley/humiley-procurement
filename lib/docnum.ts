import { randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentFiscalYear } from "@/lib/dates";

type Tx = Prisma.TransactionClient;

/**
 * Document numbering (spec §22.4). Gap-free, per-key, per-year sequences allocated under a
 * row lock (SELECT ... FOR UPDATE) so concurrent document creation never collides.
 * Format: `HML-<PREFIX>-<YEAR>-<0000>`, e.g. `HML-PR-2026-0001`.
 *
 * ALWAYS call inside the same $transaction that creates the document, so a rolled-back
 * document does not burn a number.
 */
export async function nextDocNumber(
  key: string,
  tx: Tx,
  opts: { prefix?: string; year?: number; pad?: number } = {},
): Promise<string> {
  const year = opts.year ?? currentFiscalYear();
  const prefix = opts.prefix ?? key;
  const pad = opts.pad ?? 4;

  // Ensure the counter row exists, then lock it.
  await tx.$executeRaw`
    INSERT INTO "Sequence" ("id", "key", "year", "lastValue")
    VALUES (${randomUUID()}, ${key}, ${year}, 0)
    ON CONFLICT ("key", "year") DO NOTHING`;

  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    SELECT "lastValue" FROM "Sequence"
    WHERE "key" = ${key} AND "year" = ${year}
    FOR UPDATE`;

  const next = (rows[0]?.lastValue ?? 0) + 1;

  await tx.$executeRaw`
    UPDATE "Sequence" SET "lastValue" = ${next}
    WHERE "key" = ${key} AND "year" = ${year}`;

  return `HML-${prefix}-${year}-${String(next).padStart(pad, "0")}`;
}

/** Convenience wrapper that opens its own transaction (use when not already in one). */
export function allocateDocNumber(
  key: string,
  opts: { prefix?: string; year?: number; pad?: number } = {},
): Promise<string> {
  return db.$transaction((tx) => nextDocNumber(key, tx, opts));
}
