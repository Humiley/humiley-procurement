"use server";

import { revalidatePath } from "next/cache";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export type HsImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  message?: string;
};

/** Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas/newlines, "" escapes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  const s = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c === "\r") { /* ignore, handled by \n */ }
    else field += c;
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((v) => v.trim() !== ""));
}

const HEADER_ALIASES: Record<string, string> = {
  code: "code", "hs code": "code", hscode: "code",
  descriptionen: "en", "description en": "en", "description (en)": "en", en: "en", description: "en",
  descriptionvn: "vn", "description vn": "vn", "description (vn)": "vn", vn: "vn",
  category: "category", group: "category",
  keywords: "keywords", synonyms: "keywords",
  uom: "uom", "customs uom": "uom", uomcustoms: "uom",
  mfn: "mfn", "mfn %": "mfn", mfndutypct: "mfn", "mfn duty": "mfn",
  vat: "vat", "vat %": "vat", vatimportpct: "vat", "import vat": "vat",
  notes: "notes", note: "notes",
};

const HS_CODE_RE = /^\d{4}(\.\d{2}){0,3}$/; // 8415 · 8415.83 · 8415.83.10 · 8415.83.10.00

/**
 * Import the official HS tariff from CSV (Admin / Purchasing only). Upserts by `code`, so it is
 * safe to re-run — existing rows are updated, new rows added, nothing is deleted. A row that
 * supplies an MFN rate is marked dutyVerified; rows without a rate stay reference-only.
 */
export async function importHsCodes(csvText: string): Promise<HsImportResult> {
  const user = await requireUser();
  if (!hasAnyRole(user, ["ADMIN", "PURCHASER"])) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: [], message: "Not authorised to import HS codes." };
  }

  const rows = parseCsv(csvText || "");
  if (rows.length < 2) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: [], message: "No data rows found. Include a header row and at least one code." };
  }

  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);
  const ci = idx("code");
  const ei = idx("en");
  if (ci === -1 || ei === -1) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: [], message: 'CSV must have at least "code" and "descriptionEn" columns.' };
  }
  const vi = idx("vn"), gi = idx("category"), ki = idx("keywords"), ui = idx("uom"), mi = idx("mfn"), ti = idx("vat"), ni = idx("notes");

  let created = 0, updated = 0, skipped = 0;
  const errors: string[] = [];
  const num = (v: string | undefined) => {
    if (v == null || v.trim() === "") return null;
    const n = Number(v.replace(/[%\s,]/g, ""));
    return Number.isFinite(n) ? n : null;
  };

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const code = (cells[ci] ?? "").trim();
    const en = (cells[ei] ?? "").trim();
    if (!code) { skipped++; continue; }
    if (!HS_CODE_RE.test(code)) { skipped++; if (errors.length < 12) errors.push(`Row ${r + 1}: "${code}" is not a valid HS code (expected e.g. 8415.83).`); continue; }
    if (!en) { skipped++; if (errors.length < 12) errors.push(`Row ${r + 1}: missing English description for ${code}.`); continue; }

    const mfn = mi >= 0 ? num(cells[mi]) : null;
    const vat = ti >= 0 ? num(cells[ti]) : null;
    const data = {
      descriptionEn: en,
      descriptionVn: vi >= 0 ? (cells[vi] ?? "").trim() : "",
      category: gi >= 0 && cells[gi]?.trim() ? cells[gi].trim() : null,
      keywords: ki >= 0 && cells[ki]?.trim() ? cells[ki].trim() : null,
      uomCustoms: ui >= 0 && cells[ui]?.trim() ? cells[ui].trim() : null,
      notes: ni >= 0 && cells[ni]?.trim() ? cells[ni].trim() : null,
      ...(mfn != null ? { mfnDutyPct: mfn, vatImportPct: vat ?? 10, dutyVerified: true } : {}),
    };

    try {
      const existing = await db.hsCode.findUnique({ where: { code }, select: { id: true } });
      if (existing) {
        await db.hsCode.update({ where: { code }, data });
        updated++;
      } else {
        await db.hsCode.create({ data: { code, ...data } });
        created++;
      }
    } catch {
      skipped++;
      if (errors.length < 12) errors.push(`Row ${r + 1}: could not save ${code}.`);
    }
  }

  await audit({
    userId: user.id,
    action: "HS_IMPORT",
    entityType: "HsCode",
    entityId: "bulk",
    after: { created, updated, skipped },
  });
  revalidatePath("/reference/hs-codes");

  return {
    ok: created + updated > 0,
    created,
    updated,
    skipped,
    errors,
    message: `Imported ${created + updated} code(s): ${created} new, ${updated} updated${skipped ? `, ${skipped} skipped` : ""}.`,
  };
}
