import "server-only";
import { db } from "@/lib/db";

/**
 * §20 landed-cost math. Customs value (VND) = unitPrice × qty × fx + freight + handling
 * (approximates CIF for FOB/EXW terms; for CIF/DAP/DDP quotes freight/handling default 0).
 * Duty = customs value × duty%. Import VAT = (customs value + duty) × VAT% — shown in the
 * breakdown but NOT included in the landed unit cost (deductible input VAT for VAT-registered
 * VN businesses). Landed total = customs value + duty.
 */
export type LandedRoute = {
  routeKey: string;          // "MFN" or CooFormCode
  routeLabel: string;        // e.g. "Form E (ACFTA — China)"
  cooFormTypeId: string | null;
  countries: string[];
  dutyPct: number;
  importVatPct: number;
  customsValueVnd: number;
  dutyVnd: number;
  importVatVnd: number;
  landedTotalVnd: number;
  landedUnitCostVnd: number;
  cheapest: boolean;
};

export type LandedInput = {
  hsCodeId: string;
  unitPrice: number;
  currency: string;
  fxRate: number;
  qty: number;
  freightEstVnd: number;
  handlingEstVnd: number;
};

export async function computeLandedRoutes(input: LandedInput): Promise<{ routes: LandedRoute[]; hs: { code: string; descriptionEn: string; descriptionVn: string; mfnDutyPct: number; vatImportPct: number; notes: string | null } }> {
  const hs = await db.hsCode.findUniqueOrThrow({
    where: { id: input.hsCodeId },
    include: { duties: { include: { cooFormType: true } } },
  });

  const qty = Math.max(input.qty, 1);
  const customsValue = input.unitPrice * qty * input.fxRate + input.freightEstVnd + input.handlingEstVnd;
  const vatPct = Number(hs.vatImportPct);

  const mkRoute = (routeKey: string, routeLabel: string, cooFormTypeId: string | null, countries: string[], dutyPct: number): LandedRoute => {
    const duty = (customsValue * dutyPct) / 100;
    const vat = ((customsValue + duty) * vatPct) / 100;
    const landed = customsValue + duty;
    return {
      routeKey,
      routeLabel,
      cooFormTypeId,
      countries,
      dutyPct,
      importVatPct: vatPct,
      customsValueVnd: Math.round(customsValue),
      dutyVnd: Math.round(duty),
      importVatVnd: Math.round(vat),
      landedTotalVnd: Math.round(landed),
      landedUnitCostVnd: Math.round(landed / qty),
      cheapest: false,
    };
  };

  const routes = [
    mkRoute("MFN", "MFN", null, [], Number(hs.mfnDutyPct)),
    ...hs.duties.map((d) =>
      mkRoute(d.cooFormType.code, `${d.cooFormType.code.replace("_", " ")} (${d.cooFormType.agreementName})`, d.cooFormTypeId, d.cooFormType.countries, Number(d.preferentialDutyPct)),
    ),
  ];
  const min = Math.min(...routes.map((r) => r.landedUnitCostVnd));
  for (const r of routes) r.cheapest = r.landedUnitCostVnd === min;

  return {
    routes,
    hs: {
      code: hs.code,
      descriptionEn: hs.descriptionEn,
      descriptionVn: hs.descriptionVn,
      mfnDutyPct: Number(hs.mfnDutyPct),
      vatImportPct: vatPct,
      notes: hs.notes,
    },
  };
}
