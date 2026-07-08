import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { PoForm, type PoFormLine, type PoFormOpt, type PoVendorContract } from "@/components/po/PoForm";

/** §8: new PO — standalone, or prefilled from an APPROVED PR via ?fromPr=<id>. PURCHASER/ADMIN. */
export default async function NewPoPage({ searchParams }: { searchParams: { fromPr?: string } }) {
  await requireRoles("PURCHASER", "ADMIN");

  const now = new Date();
  const [vendors, uoms, activeContracts] = await Promise.all([
    db.vendor.findMany({ where: { status: "APPROVED" }, orderBy: { code: "asc" } }),
    db.uom.findMany({ orderBy: { code: "asc" } }),
    db.contract.findMany({ where: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } } }),
  ]);
  const contracts: Record<string, PoVendorContract> = {};
  for (const c of activeContracts) {
    contracts[c.vendorId] = { contractNumber: c.contractNumber, prices: (c.priceListJson ?? {}) as Record<string, string> };
  }

  let fromPr: { id: string; label: string } | null = null;
  let initialLines: PoFormLine[] = [];
  if (searchParams.fromPr) {
    const pr = await db.purchaseRequisition.findUnique({
      where: { id: searchParams.fromPr },
      include: { lines: { include: { item: { select: { code: true, nameEn: true } } } } },
    });
    if (pr && pr.status === "APPROVED") {
      fromPr = { id: pr.id, label: pr.prNumber };
      initialLines = pr.lines.map((l) => ({
        prLineId: l.id,
        itemId: l.itemId,
        description: l.item ? `${l.item.code} · ${l.item.nameEn}` : l.freeTextDescription || "",
        uomId: l.uomId,
        qty: decToString(l.qty, 4) ?? "1",
        unitPrice: decToString(l.estUnitPriceVnd, 2) ?? "0",
      }));
    }
  }

  const vendorOpts: PoFormOpt[] = vendors.map((v) => ({ id: v.id, label: `${v.code} · ${v.nameEn}` }));
  const uomOpts: PoFormOpt[] = uoms.map((u) => ({ id: u.id, label: u.code }));

  return <PoForm vendors={vendorOpts} uoms={uomOpts} fromPr={fromPr} initialLines={initialLines} contracts={contracts} />;
}
