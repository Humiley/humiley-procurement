import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { PoForm, type PoFormLine, type PoFormOpt, type PoVendorContract } from "@/components/po/PoForm";

/** §8: new PO — standalone, or prefilled from an APPROVED PR via ?fromPr=<id>. PURCHASER/ADMIN. */
export default async function NewPoPage({ searchParams }: { searchParams: { fromPr?: string } }) {
  await requireRoles("PURCHASER", "ADMIN");
  const tc = await getTranslations("common");

  const now = new Date();
  const [vendors, uoms, activeContracts] = await Promise.all([
    db.vendor.findMany({ where: { status: "APPROVED" }, orderBy: { code: "asc" } }),
    db.uom.findMany({ orderBy: { code: "asc" } }),
    db.contract.findMany({ where: { status: "ACTIVE", startDate: { lte: now }, endDate: { gte: now } } }),
  ]);
  // §22 prerequisite empty state: a PO cannot be drafted without an approved vendor.
  if (vendors.length === 0) {
    const tp = await getTranslations("prereq");
    return (
      <div className="space-y-4">
        <Link href="/purchase-orders" className="btn-ghost -ml-3 w-fit">
          <ArrowLeft className="h-4 w-4" /> {tc("back")}
        </Link>
        <div className="card mx-auto max-w-lg p-6 text-center">
          <h1 className="page-title">{tp("title")}</h1>
          <p className="mt-2 text-sm text-grey">{tp("poBody")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link href="/purchase-orders" className="btn-ghost">{tp("backToList")}</Link>
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-4">
      <Link href="/purchase-orders" className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <PoForm vendors={vendorOpts} uoms={uomOpts} fromPr={fromPr} initialLines={initialLines} contracts={contracts} />
    </div>
  );
}
