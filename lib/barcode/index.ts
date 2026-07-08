import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

type Tx = Prisma.TransactionClient;

/**
 * §21 barcode layer — lot numbers, barcode rows, and server-side rendering with bwip-js.
 * Item barcodes are CODE128 of the item code; lot labels are QR with a JSON payload.
 */

/** Auto lot number LOT-YYMMDD-#### (gap-free via the shared Sequence table, key "LOT"). */
export async function nextLotNumber(tx: Tx, when = new Date()): Promise<string> {
  const year = when.getFullYear();
  await tx.$executeRaw`
    INSERT INTO "Sequence" ("id", "key", "year", "lastValue") VALUES (${randomUUID()}, 'LOT', ${year}, 0)
    ON CONFLICT ("key", "year") DO NOTHING`;
  const rows = await tx.$queryRaw<Array<{ lastValue: number }>>`
    SELECT "lastValue" FROM "Sequence" WHERE "key" = 'LOT' AND "year" = ${year} FOR UPDATE`;
  const next = (rows[0]?.lastValue ?? 0) + 1;
  await tx.$executeRaw`UPDATE "Sequence" SET "lastValue" = ${next} WHERE "key" = 'LOT' AND "year" = ${year}`;
  const ymd = `${String(year).slice(2)}${String(when.getMonth() + 1).padStart(2, "0")}${String(when.getDate()).padStart(2, "0")}`;
  return `LOT-${ymd}-${String(next).padStart(4, "0")}`;
}

/** Item barcode (CODE128 of the item code) — created on demand, once. */
export async function ensureItemBarcode(tx: Tx, itemId: string, itemCode: string) {
  const existing = await tx.barcode.findFirst({ where: { type: "ITEM", itemId } });
  if (existing) return existing;
  return tx.barcode.create({ data: { code: itemCode, type: "ITEM", itemId, format: "CODE128" } });
}

/** Lot QR barcode — payload `LOT:<lotNumber>` (scan hub resolves it). */
export async function createLotBarcode(tx: Tx, lotId: string, lotNumber: string, itemId: string) {
  return tx.barcode.create({ data: { code: `LOT:${lotNumber}`, type: "LOT", lotId, itemId, format: "QR" } });
}

/** Render any barcode to a PNG data-URI (bwip-js, server-side). */
export async function barcodeDataUri(text: string, format: "CODE128" | "QR"): Promise<string> {
  const bwipjs = (await import("bwip-js")).default;
  const png = await bwipjs.toBuffer(
    format === "QR"
      ? { bcid: "qrcode", text, scale: 3 }
      : { bcid: "code128", text, scale: 2, height: 10, includetext: true, textxalign: "center" },
  );
  return `data:image/png;base64,${png.toString("base64")}`;
}

/** Resolve any scanned/typed code: document number, LOT:…, lot number, or item code. */
export async function resolveScan(raw: string) {
  const code = raw.trim();
  if (!code) return { kind: "none" as const };

  const doc = code.toUpperCase();
  const docRoutes: [RegExp, (id: string) => string, string][] = [
    [/^HML-PR-/, (id) => `/requisitions/${id}`, "purchaseRequisition"],
    [/^HML-PO-/, (id) => `/purchase-orders/${id}`, "purchaseOrder"],
    [/^HML-GRN-/, (id) => `/goods-receipts/${id}`, "goodsReceipt"],
    [/^HML-GI-/, (id) => `/inventory/issues/${id}`, "goodsIssue"],
    [/^HML-TRF-/, (id) => `/inventory/transfers/${id}`, "stockTransfer"],
    [/^HML-CNT-/, (id) => `/inventory/counts/${id}`, "stockCount"],
    [/^HML-PAY-/, (id) => `/payment-requests/${id}`, "paymentRequest"],
    [/^HML-INV-/, (id) => `/invoices/${id}`, "invoice"],
    [/^HML-CTR-/, (id) => `/contracts/${id}`, "contract"],
  ];
  for (const [re, route, model] of docRoutes) {
    if (re.test(doc)) {
      const numberField: Record<string, string> = {
        purchaseRequisition: "prNumber", purchaseOrder: "poNumber", goodsReceipt: "grnNumber",
        goodsIssue: "issueNumber", stockTransfer: "transferNumber", stockCount: "countNumber",
        paymentRequest: "paymentRequestNumber", invoice: "invoiceNumber", contract: "contractNumber",
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const row = await (db as any)[model].findUnique({ where: { [numberField[model]]: doc }, select: { id: true } });
      if (row) return { kind: "document" as const, href: route(row.id), label: doc };
      return { kind: "notFound" as const, code };
    }
  }

  const lotNumber = code.toUpperCase().startsWith("LOT:") ? code.slice(4) : code;
  const lot = await db.lot.findFirst({
    where: { lotNumber: { equals: lotNumber, mode: "insensitive" } },
    include: { item: { select: { id: true, code: true, nameEn: true } } },
  });
  if (lot) return { kind: "lot" as const, lotId: lot.id, label: lot.lotNumber, item: `${lot.item.code} · ${lot.item.nameEn}` };

  const item = await db.item.findFirst({ where: { code: { equals: code, mode: "insensitive" } } });
  if (item) return { kind: "item" as const, itemId: item.id, label: `${item.code} · ${item.nameEn}` };

  return { kind: "notFound" as const, code };
}
