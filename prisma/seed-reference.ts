import type { PrismaClient } from "@prisma/client";
import { HS_CATALOG } from "../lib/trade/hs-catalog";
import { HS_FULL_2022 } from "./hs-full-2022";

/**
 * §20 TRADE REFERENCE DATA — genuine reference data (not demo): C/O forms, HS 2022 codes
 * (12 traded codes with researched MFN/VAT/route duty + the 150-code curated catalogue) and
 * today's FX rates. All idempotent upserts, no deletes, no demo records — so it is safe to run
 * against a fresh OR existing production DB. Called by BOTH prisma/seed.ts (demo) and
 * prisma/bootstrap.ts (production), so the HS Code Explorer is never empty in production.
 *
 * Returns the code→id map of the traded HS codes (for seed.ts to link demo items).
 */
export async function seedTradeReference(db: PrismaClient): Promise<Map<string, string>> {
  const FORMS: { code: string; agreementName: string; countries: string[]; note?: string }[] = [
    { code: "FORM_E", agreementName: "ACFTA — ASEAN–China", countries: ["CN"], note: "Most China imports reach 0% with a valid Form E." },
    { code: "FORM_D", agreementName: "ATIGA — ASEAN", countries: ["TH", "MY", "SG", "ID", "PH"], note: "Intra-ASEAN preferential rate." },
    { code: "FORM_AK", agreementName: "AKFTA — ASEAN–Korea", countries: ["KR"] },
    { code: "FORM_VK", agreementName: "VKFTA — Vietnam–Korea", countries: ["KR"], note: "Often better than AKFTA for KR-origin goods." },
    { code: "FORM_AJ", agreementName: "AJCEP — ASEAN–Japan", countries: ["JP"] },
    { code: "FORM_AANZ", agreementName: "AANZFTA — ASEAN–Australia/NZ", countries: ["AU", "NZ"] },
    { code: "EUR1", agreementName: "EVFTA — EU–Vietnam", countries: ["DE", "IT", "FR", "EU"] },
    { code: "CPTPP", agreementName: "CPTPP", countries: ["JP", "AU", "CA", "MX", "SG"] },
    { code: "FORM_S", agreementName: "VN–Laos", countries: ["LA"] },
  ];
  const formIds = new Map<string, string>();
  for (const f of FORMS) {
    const row = await db.cooFormType.upsert({
      where: { code: f.code as never },
      update: { agreementName: f.agreementName, countries: f.countries, preferentialDutyNote: f.note ?? null },
      create: { code: f.code as never, agreementName: f.agreementName, countries: f.countries, preferentialDutyNote: f.note ?? null },
    });
    formIds.set(f.code, row.id);
  }

  // Full HS 2022 nomenclature (5,613 codes) as bare reference rows — English description only,
  // no duty/VAT/VN yet (those come from the official tariff import). Loaded FIRST and with an
  // empty `update`, so it NEVER overwrites the curated catalogue, the traded codes' duty, or any
  // rates an admin has already imported; the richer loops below layer their data on top.
  // Guarded on the row count so re-running bootstrap on every update doesn't repeat 5,613 upserts.
  if ((await db.hsCode.count()) < HS_FULL_2022.length) {
    for (const h of HS_FULL_2022) {
      await db.hsCode.upsert({
        where: { code: h.code },
        update: {},
        create: { code: h.code, descriptionEn: h.en, descriptionVn: h.en, dutyVerified: false },
      });
    }
    console.log(`Seeded ${HS_FULL_2022.length} HS 2022 codes (full nomenclature).`);
  }

  // Traded codes: MFN/VAT/route researched (dutyVerified).
  const HS: { code: string; en: string; vn: string; uom: string; cat: string; mfn: number; vat: number; notes?: string; pref: [string, number][] }[] = [
    { code: "8415.83", en: "Air conditioning machines, not incorporating a refrigerating unit (AHU)", vn: "Máy điều hòa không khí không gắn bộ lạnh (AHU)", uom: "unit", cat: "HVAC & Refrigeration", mfn: 20, vat: 10, notes: "MEPS energy-efficiency check per MOIT for finished units.", pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_AK", 5], ["EUR1", 7.5]] },
    { code: "8414.59", en: "Fans — other (industrial/plug fans)", vn: "Quạt công nghiệp — loại khác", uom: "unit", cat: "Air Movement", mfn: 12.5, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_AJ", 3], ["EUR1", 5]] },
    { code: "8414.30", en: "Compressors of a kind used in refrigerating equipment", vn: "Máy nén dùng trong thiết bị lạnh", uom: "unit", cat: "HVAC & Refrigeration", mfn: 3, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_AJ", 0], ["CPTPP", 0]] },
    { code: "8421.39", en: "Filtering/purifying machinery for gases (HEPA housings, filter units)", vn: "Thiết bị lọc/làm sạch khí (hộp lọc HEPA)", uom: "unit", cat: "Air Filtration", mfn: 7, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["EUR1", 2]] },
    { code: "7019.90", en: "Glass fibre articles (filter media)", vn: "Sản phẩm sợi thủy tinh (vật liệu lọc)", uom: "kg", cat: "Air Filtration", mfn: 10, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0]] },
    { code: "8504.40", en: "Static converters (VFD, inverters, rectifiers)", vn: "Bộ biến đổi tĩnh điện (biến tần, chỉnh lưu)", uom: "unit", cat: "Electrical", mfn: 10, vat: 10, notes: "Energy-label check for motors/drives per MOIT circulars.", pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_VK", 0], ["EUR1", 3]] },
    { code: "8537.10", en: "Control panels/boards ≤ 1,000 V", vn: "Tủ/bảng điều khiển điện áp ≤ 1.000 V", uom: "unit", cat: "Electrical", mfn: 15, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_AK", 5]] },
    { code: "9032.89", en: "Automatic regulating/controlling instruments — other (controllers, sensors)", vn: "Thiết bị điều chỉnh/điều khiển tự động — loại khác", uom: "unit", cat: "Instruments", mfn: 5, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_AJ", 0], ["CPTPP", 0]] },
    { code: "8481.80", en: "Taps, cocks, valves — other (dampers, control valves)", vn: "Van, vòi — loại khác (van gió, van điều khiển)", uom: "unit", cat: "Valves & Actuators", mfn: 12, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["EUR1", 4]] },
    { code: "8536.20", en: "Automatic circuit breakers ≤ 1,000 V (MCB)", vn: "Áptômát tự động ≤ 1.000 V (MCB)", uom: "unit", cat: "Electrical", mfn: 15, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_VK", 5]] },
    { code: "8536.49", en: "Relays/contactors > 60 V", vn: "Rơle, khởi động từ > 60 V", uom: "unit", cat: "Electrical", mfn: 10, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0]] },
    { code: "8544.49", en: "Insulated electric conductors ≤ 1,000 V (cable)", vn: "Dây dẫn điện cách điện ≤ 1.000 V (cáp)", uom: "kg", cat: "Cable & Wiring", mfn: 15, vat: 10, pref: [["FORM_E", 0], ["FORM_D", 0], ["FORM_AK", 5]] },
  ];
  const hsIds = new Map<string, string>();
  for (const h of HS) {
    const row = await db.hsCode.upsert({
      where: { code: h.code },
      update: { descriptionEn: h.en, descriptionVn: h.vn, uomCustoms: h.uom, category: h.cat, mfnDutyPct: h.mfn, vatImportPct: h.vat, dutyVerified: true, notes: h.notes ?? null },
      create: { code: h.code, descriptionEn: h.en, descriptionVn: h.vn, uomCustoms: h.uom, category: h.cat, mfnDutyPct: h.mfn, vatImportPct: h.vat, dutyVerified: true, notes: h.notes ?? null },
    });
    hsIds.set(h.code, row.id);
    for (const [form, pct] of h.pref) {
      await db.hsCodeDuty.upsert({
        where: { hsCodeId_cooFormTypeId: { hsCodeId: row.id, cooFormTypeId: formIds.get(form)! } },
        update: { preferentialDutyPct: pct },
        create: { hsCodeId: row.id, cooFormTypeId: formIds.get(form)!, preferentialDutyPct: pct },
      });
    }
  }

  // Reference catalogue: curated HS 2022 subheadings; duty NOT asserted (dutyVerified = false).
  for (const h of HS_CATALOG) {
    if (hsIds.has(h.code)) continue; // never override a traded code
    await db.hsCode.upsert({
      where: { code: h.code },
      update: { descriptionEn: h.en, descriptionVn: h.vn, category: h.category, keywords: h.keywords ?? null, dutyVerified: false },
      create: { code: h.code, descriptionEn: h.en, descriptionVn: h.vn, category: h.category, keywords: h.keywords ?? null, dutyVerified: false },
    });
  }

  const today = new Date(new Date().toDateString());
  const FX: [string, number][] = [["USD", 25_450], ["EUR", 27_600], ["CNY", 3_510], ["JPY", 163], ["KRW", 18.4]];
  for (const [cur, rate] of FX) {
    await db.fxRate.upsert({
      where: { currency_rateDate: { currency: cur, rateDate: today } },
      update: { rateToVnd: rate },
      create: { currency: cur, rateDate: today, rateToVnd: rate, source: "MANUAL" },
    });
  }
  console.log(`Seeded §20 trade reference: ${FORMS.length} C/O forms, ${HS.length} traded + ${HS_CATALOG.length} catalogue HS codes, ${FX.length} FX rates.`);
  return hsIds;
}
