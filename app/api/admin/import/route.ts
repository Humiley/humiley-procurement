import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { currentUser, isAdmin } from "@/lib/rbac";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

type ImportResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
};

/** Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, BOM). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // ignore
    } else field += c;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object") {
    if ("text" in v && typeof v.text === "string") return v.text;
    if ("result" in v && v.result != null) return String(v.result);
    if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join("");
    return "";
  }
  return String(v);
}

async function readRows(file: File): Promise<string[][]> {
  const buf = Buffer.from(await file.arrayBuffer());
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(buf.toString("utf8"));
  }
  const wb = new ExcelJS.Workbook();
  // exceljs's bundled Buffer type lags @types/node 20's generic Buffer; cast to its own param type.
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  ws.eachRow((row) => {
    const values: string[] = [];
    // exceljs row.values is 1-indexed with a leading null
    const raw = row.values as ExcelJS.CellValue[];
    for (let i = 1; i < raw.length; i++) values.push(cellText(raw[i]));
    if (values.some((c) => c.trim() !== "")) rows.push(values);
  });
  return rows;
}

function truthy(s: string): boolean {
  const v = s.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "y" || v === "x";
}

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user || !isAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  if (kind !== "items" && kind !== "vendors") {
    return NextResponse.json({ error: "Unknown import kind" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  let matrix: string[][];
  try {
    matrix = await readRows(file);
  } catch {
    return NextResponse.json({ error: "Could not read the file (expect .xlsx or .csv)." }, { status: 400 });
  }
  if (matrix.length < 2) {
    return NextResponse.json({ error: "The file has no data rows." }, { status: 400 });
  }

  const header = matrix[0].map((h) => h.trim());
  const idx = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const result: ImportResult = { created: 0, updated: 0, skipped: 0, errors: [] };

  if (kind === "items") {
    const [cats, uoms] = await Promise.all([db.category.findMany(), db.uom.findMany()]);
    const catByCode = new Map(cats.map((c) => [c.code.toLowerCase(), c.id]));
    const uomByCode = new Map(uoms.map((u) => [u.code.toLowerCase(), u.id]));
    const cCode = idx("code"),
      cEn = idx("nameEn"),
      cVn = idx("nameVn"),
      cCat = idx("categoryCode"),
      cUom = idx("uomCode"),
      cSpec = idx("specDescription"),
      cPrice = idx("lastPriceVnd"),
      cLot = idx("isLotTracked");

    for (let r = 1; r < matrix.length; r++) {
      const row = matrix[r];
      const code = (row[cCode] ?? "").trim();
      const nameEn = (row[cEn] ?? "").trim();
      const nameVn = (row[cVn] ?? "").trim();
      const catId = catByCode.get((row[cCat] ?? "").trim().toLowerCase());
      const uomId = uomByCode.get((row[cUom] ?? "").trim().toLowerCase());
      if (!code || !nameEn || !nameVn) {
        result.skipped++;
        result.errors.push(`Row ${r + 1}: missing code/name.`);
        continue;
      }
      if (!catId || !uomId) {
        result.skipped++;
        result.errors.push(`Row ${r + 1}: unknown categoryCode/uomCode.`);
        continue;
      }
      const priceRaw = cPrice >= 0 ? (row[cPrice] ?? "").replace(/[^\d.]/g, "") : "";
      const data = {
        nameEn,
        nameVn,
        categoryId: catId,
        uomId,
        specDescription: cSpec >= 0 ? (row[cSpec] ?? "").trim() || null : null,
        lastPriceVnd: priceRaw ? new Prisma.Decimal(priceRaw) : null,
        isLotTracked: cLot >= 0 ? truthy(row[cLot] ?? "") : false,
      };
      const existing = await db.item.findUnique({ where: { code } });
      await db.item.upsert({ where: { code }, update: data, create: { code, ...data } });
      if (existing) result.updated++;
      else result.created++;
    }
  } else {
    const cCode = idx("code"),
      cEn = idx("nameEn"),
      cVn = idx("nameVn"),
      cTax = idx("taxCode"),
      cName = idx("contactName"),
      cEmail = idx("contactEmail"),
      cPhone = idx("contactPhone"),
      cTerm = idx("paymentTermDays"),
      cBank = idx("bankName"),
      cAcct = idx("bankAccount"),
      cCats = idx("categories");

    for (let r = 1; r < matrix.length; r++) {
      const row = matrix[r];
      const code = (row[cCode] ?? "").trim();
      const nameEn = (row[cEn] ?? "").trim();
      const nameVn = (row[cVn] ?? "").trim();
      if (!code || !nameEn || !nameVn) {
        result.skipped++;
        result.errors.push(`Row ${r + 1}: missing code/name.`);
        continue;
      }
      const termRaw = cTerm >= 0 ? parseInt((row[cTerm] ?? "").replace(/[^\d]/g, ""), 10) : NaN;
      const data = {
        nameEn,
        nameVn,
        taxCode: cTax >= 0 ? (row[cTax] ?? "").trim() || null : null,
        contactName: cName >= 0 ? (row[cName] ?? "").trim() || null : null,
        contactEmail: cEmail >= 0 ? (row[cEmail] ?? "").trim() || null : null,
        contactPhone: cPhone >= 0 ? (row[cPhone] ?? "").trim() || null : null,
        paymentTermDays: Number.isFinite(termRaw) ? termRaw : 30,
        bankName: cBank >= 0 ? (row[cBank] ?? "").trim() || null : null,
        bankAccount: cAcct >= 0 ? (row[cAcct] ?? "").trim() || null : null,
        categories:
          cCats >= 0
            ? (row[cCats] ?? "")
                .split(/[,;]/)
                .map((x) => x.trim())
                .filter(Boolean)
            : [],
      };
      const existing = await db.vendor.findUnique({ where: { code } });
      await db.vendor.upsert({ where: { code }, update: data, create: { code, ...data } });
      if (existing) result.updated++;
      else result.created++;
    }
  }

  await audit({
    userId: user.id,
    action: kind === "items" ? "ITEM_IMPORT" : "VENDOR_IMPORT",
    entityType: kind === "items" ? "Item" : "Vendor",
    entityId: "bulk",
    after: { created: result.created, updated: result.updated, skipped: result.skipped },
  });

  return NextResponse.json(result);
}
