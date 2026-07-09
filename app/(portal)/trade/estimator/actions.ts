"use server";

import { z } from "zod";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { computeLandedRoutes, type LandedRoute } from "@/lib/trade/landed";
import { latestFxRates } from "@/lib/fx";
import { guard } from "@/lib/safe-action";

export type TradeHit = { hsCodeId: string; hsCode: string; label: string; itemId: string | null; origin: string | null; lastPriceVnd: string | null };

/** §20 estimator search — item name/code or HS code → HS candidates. */
async function _searchTrade(q: string): Promise<TradeHit[]> {
  await requireUser();
  const query = q.trim();
  if (query.length < 2) return [];

  const [items, codes] = await Promise.all([
    db.itemTrade.findMany({
      where: {
        item: { OR: [{ code: { contains: query, mode: "insensitive" } }, { nameEn: { contains: query, mode: "insensitive" } }, { nameVn: { contains: query, mode: "insensitive" } }] },
      },
      include: { item: { select: { id: true, code: true, nameEn: true, lastPriceVnd: true } }, hsCode: { select: { id: true, code: true } } },
      take: 6,
    }),
    db.hsCode.findMany({
      where: { OR: [{ code: { contains: query } }, { descriptionEn: { contains: query, mode: "insensitive" } }, { descriptionVn: { contains: query, mode: "insensitive" } }] },
      take: 6,
    }),
  ]);

  const hits: TradeHit[] = items.map((it) => ({
    hsCodeId: it.hsCode.id,
    hsCode: it.hsCode.code,
    label: `${it.item.code} · ${it.item.nameEn}`,
    itemId: it.item.id,
    origin: it.originCountry,
    lastPriceVnd: it.item.lastPriceVnd ? String(it.item.lastPriceVnd) : null,
  }));
  for (const h of codes) {
    if (!hits.some((x) => x.hsCodeId === h.id)) {
      hits.push({ hsCodeId: h.id, hsCode: h.code, label: `HS ${h.code} · ${h.descriptionEn}`, itemId: null, origin: null, lastPriceVnd: null });
    }
  }
  return hits.slice(0, 8);
}

async function _fxRates(): Promise<Record<string, number>> {
  await requireUser();
  return latestFxRates();
}

const estimateSchema = z.object({
  hsCodeId: z.string().min(1),
  itemId: z.string().optional().nullable(),
  unitPrice: z.coerce.number().positive(),
  currency: z.string().trim().toUpperCase().length(3),
  fxRate: z.coerce.number().positive(),
  qty: z.coerce.number().positive(),
  freightEstVnd: z.coerce.number().min(0).default(0),
  handlingEstVnd: z.coerce.number().min(0).default(0),
  originCountry: z.string().trim().toUpperCase().optional().nullable(),
  incoterm: z.string().optional().nullable(),
});
export type EstimatePayload = z.input<typeof estimateSchema>;
export type EstimateResult = {
  routes: LandedRoute[];
  hs: { code: string; descriptionEn: string; descriptionVn: string; mfnDutyPct: number; vatImportPct: number; notes: string | null };
  savedId: string;
};

/** Compute the duty-comparison card and persist the estimate (§20 LandedCostEstimate). */
async function _estimateLanded(input: EstimatePayload): Promise<EstimateResult> {
  const user = await requireUser();
  const v = estimateSchema.parse(input);

  const { routes, hs } = await computeLandedRoutes({
    hsCodeId: v.hsCodeId,
    unitPrice: v.unitPrice,
    currency: v.currency,
    fxRate: v.fxRate,
    qty: v.qty,
    freightEstVnd: v.freightEstVnd,
    handlingEstVnd: v.handlingEstVnd,
  });

  // grey-out logic lives client-side; persistence keeps the cheapest viable route
  const viable = v.originCountry ? routes.filter((r) => !r.countries.length || r.countries.includes(v.originCountry!)) : routes;
  const best = viable.find((r) => r.landedUnitCostVnd === Math.min(...viable.map((x) => x.landedUnitCostVnd))) ?? routes[0];

  const saved = await db.landedCostEstimate.create({
    data: {
      itemId: v.itemId ?? null,
      hsCodeId: v.hsCodeId,
      originCountry: v.originCountry ?? null,
      cooFormTypeId: best.cooFormTypeId,
      incoterm: v.incoterm ?? null,
      currency: v.currency,
      fxRate: v.fxRate,
      unitPrice: v.unitPrice,
      qty: v.qty,
      freightEst: v.freightEstVnd,
      handlingEst: v.handlingEstVnd,
      dutyPct: best.dutyPct,
      importVatPct: best.importVatPct,
      landedUnitCostVnd: best.landedUnitCostVnd,
      createdById: user.id,
    },
  });
  await audit({ userId: user.id, action: "LANDED_ESTIMATE", entityType: "LandedCostEstimate", entityId: saved.id, after: { hs: hs.code, best: best.routeKey, landedUnit: best.landedUnitCostVnd } });

  return { routes, hs, savedId: saved.id };
}

/* guarded exports — expected failures travel as data so production keeps real messages (lib/safe-action.ts) */
export async function searchTrade(...a: Parameters<typeof _searchTrade>) { return guard(_searchTrade, a); }
export async function fxRates(...a: Parameters<typeof _fxRates>) { return guard(_fxRates, a); }
export async function estimateLanded(...a: Parameters<typeof _estimateLanded>) { return guard(_estimateLanded, a); }
