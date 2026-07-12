"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";

export type HsImportResult = {
  ok: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  /** Message key for the client to translate (see HsImportPanel): done | notAuth | noRows | noCols. */
  code: "done" | "notAuth" | "noRows" | "noCols";
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

// C/O-form preferential-rate columns → CooFormCode. Import a rate per applicable form so the
// duty-by-C/O matrix is populated from the official tariff (e.g. a Form E column of 0 = 0% ACFTA).
const FORM_ALIASES: Record<string, string> = {
  form_e: "FORM_E", forme: "FORM_E", "form e": "FORM_E", acfta: "FORM_E",
  form_d: "FORM_D", formd: "FORM_D", "form d": "FORM_D", atiga: "FORM_D",
  form_ak: "FORM_AK", formak: "FORM_AK", "form ak": "FORM_AK", akfta: "FORM_AK",
  form_vk: "FORM_VK", formvk: "FORM_VK", "form vk": "FORM_VK", vkfta: "FORM_VK",
  form_aj: "FORM_AJ", formaj: "FORM_AJ", "form aj": "FORM_AJ", ajcep: "FORM_AJ",
  form_aanz: "FORM_AANZ", formaanz: "FORM_AANZ", "form aanz": "FORM_AANZ", aanzfta: "FORM_AANZ",
  eur1: "EUR1", "eur.1": "EUR1", eur_1: "EUR1", evfta: "EUR1",
  cptpp: "CPTPP",
  form_s: "FORM_S", "form s": "FORM_S",
};

// Dotted (8415 · 8415.83 · 8415.83.10 · 8415.83.10.00) OR plain 6/8/10-digit — the official
// General Department of Vietnam Customs tariff is usually exported without dots.
const HS_CODE_RE = /^(\d{4}(\.\d{2}){0,3}|\d{6}|\d{8}|\d{10})$/;

/**
 * Import the official HS tariff from CSV (Admin / Purchasing only). Upserts by `code`, so it is
 * safe to re-run — existing rows are updated, new rows added, nothing is deleted. A row that
 * supplies an MFN rate is marked dutyVerified; rows without a rate stay reference-only.
 */
export async function importHsCodes(csvText: string): Promise<HsImportResult> {
  const user = await requireUser();
  if (!hasAnyRole(user, ["ADMIN", "PURCHASER"])) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: [], code: "notAuth" };
  }

  const rows = parseCsv(csvText || "");
  if (rows.length < 2) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: [], code: "noRows" };
  }

  const header = rows[0].map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? h.trim().toLowerCase());
  const idx = (key: string) => header.indexOf(key);
  const ci = idx("code");
  const ei = idx("en");
  if (ci === -1 || ei === -1) {
    return { ok: false, created: 0, updated: 0, skipped: 0, errors: [], code: "noCols" };
  }
  const vi = idx("vn"), gi = idx("category"), ki = idx("keywords"), ui = idx("uom"), mi = idx("mfn"), ti = idx("vat"), ni = idx("notes");

  // C/O-form columns present in this CSV → their DB ids (skip forms that aren't seeded).
  const rawHeader = rows[0].map((h) => h.trim().toLowerCase());
  const forms = await db.cooFormType.findMany({ select: { id: true, code: true } });
  const formIdByCode = new Map(forms.map((f) => [String(f.code), f.id]));
  const formCols: { col: number; formId: string }[] = [];
  rawHeader.forEach((h, col) => {
    const fc = FORM_ALIASES[h];
    const fid = fc ? formIdByCode.get(fc) : undefined;
    if (fid) formCols.push({ col, formId: fid });
  });

  let created = 0, updated = 0, skipped = 0;
  const errors: string[] = [];
  const num = (v: string | undefined) => {
    if (v == null || v.trim() === "") return null;
    let s = v.replace(/[%\s]/g, "");
    // A single comma with no dot is a decimal separator (VN/EU); otherwise commas are thousands.
    s = s.includes(",") && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, "");
    const n = Number(s);
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
    // Only set fields whose column is actually present + non-blank, so a partial re-import
    // (e.g. the official tariff, which has no category/keywords) never wipes curated data.
    const data: Prisma.HsCodeUncheckedUpdateInput = { descriptionEn: en };
    if (vi >= 0 && cells[vi]?.trim()) data.descriptionVn = cells[vi].trim();
    if (gi >= 0 && cells[gi]?.trim()) data.category = cells[gi].trim();
    if (ki >= 0 && cells[ki]?.trim()) data.keywords = cells[ki].trim();
    if (ui >= 0 && cells[ui]?.trim()) data.uomCustoms = cells[ui].trim();
    if (ni >= 0 && cells[ni]?.trim()) data.notes = cells[ni].trim();
    if (mfn != null) { data.mfnDutyPct = mfn; data.vatImportPct = vat ?? 10; }
    else if (vat != null) data.vatImportPct = vat; // VAT can be imported on its own
    const formRatesPresent = formCols.some(({ col }) => num(cells[col]) != null);
    if (mfn != null || formRatesPresent) data.dutyVerified = true; // researched duty/route → not a bare reference

    try {
      const existing = await db.hsCode.findUnique({ where: { code }, select: { id: true } });
      let hsId: string;
      if (existing) {
        await db.hsCode.update({ where: { code }, data });
        hsId = existing.id;
        updated++;
      } else {
        const row = await db.hsCode.create({ data: { code, descriptionVn: "", ...data } as Prisma.HsCodeUncheckedCreateInput });
        hsId = row.id;
        created++;
      }
      // Preferential rate per applicable C/O form → the duty-by-C/O matrix.
      for (const { col, formId } of formCols) {
        const rate = num(cells[col]);
        if (rate == null) continue;
        await db.hsCodeDuty.upsert({
          where: { hsCodeId_cooFormTypeId: { hsCodeId: hsId, cooFormTypeId: formId } },
          update: { preferentialDutyPct: rate },
          create: { hsCodeId: hsId, cooFormTypeId: formId, preferentialDutyPct: rate },
        });
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

  return { ok: created + updated > 0, created, updated, skipped, errors, code: "done" };
}
