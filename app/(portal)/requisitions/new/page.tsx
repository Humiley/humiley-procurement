import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireUser, isAdmin } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { PrForm, type CostCenterOpt } from "@/components/pr/PrForm";
import type { CatalogItem, UomOpt } from "@/components/pr/PrLinesEditor";

export default async function NewRequisitionPage() {
  const user = await requireUser();
  const t = await getTranslations("pr");
  const tc = await getTranslations("common");

  const [dept, costCenters, items, uoms, stock] = await Promise.all([
    user.departmentId ? db.department.findUnique({ where: { id: user.departmentId } }) : null,
    db.costCenter.findMany({
      where: user.departmentId ? { departmentId: user.departmentId } : undefined,
      orderBy: { code: "asc" },
    }),
    db.item.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
    db.uom.findMany({ orderBy: { code: "asc" } }),
    db.stockBalance.groupBy({ by: ["itemId"], _sum: { qtyOnHand: true } }),   // §5 stock hint: free stock across warehouses
  ]);

  // §22 prerequisite empty state: a PR needs a cost center for the requester's department.
  if (costCenters.length === 0) {
    const tp = await getTranslations("prereq");
    return (
      <div className="space-y-4">
        <Link href="/requisitions" className="btn-ghost -ml-3 w-fit">
          <ArrowLeft className="h-4 w-4" /> {tc("back")}
        </Link>
        <div className="card mx-auto max-w-lg p-6 text-center">
          <h1 className="text-lg font-bold text-navy">{tp("title")}</h1>
          <p className="mt-2 text-sm text-grey">{tp("prBody")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {isAdmin(user) ? (
              <Link href="/admin/cost-centers" className="btn-outline">{tp("adminLink")}</Link>
            ) : null}
            <Link href="/requisitions" className="btn-ghost">{tp("backToList")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const stockByItem = new Map(stock.map((s) => [s.itemId, s._sum.qtyOnHand]));
  const ccOpts: CostCenterOpt[] = costCenters.map((c) => ({ id: c.id, label: `${c.code} · ${c.nameEn}` }));
  const itemOpts: CatalogItem[] = items.map((i) => {
    const fs = stockByItem.get(i.id);
    return {
      id: i.id,
      label: `${i.code} · ${i.nameEn}`,
      uomId: i.uomId,
      lastPriceVnd: decToString(i.lastPriceVnd, 0) ?? "",
      freeStock: fs && !fs.isZero() ? (decToString(fs, 0) ?? "") : "",
    };
  });
  const uomOpts: UomOpt[] = uoms.map((u) => ({ id: u.id, label: `${u.code} · ${u.nameEn}` }));
  const deptLabel = dept ? `${dept.code} · ${dept.nameEn}` : "—";

  return (
    <div className="space-y-4">
      <Link href="/requisitions" className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <h1 className="text-xl font-bold text-navy">{t("new")}</h1>
      <PrForm costCenters={ccOpts} items={itemOpts} uoms={uomOpts} departmentLabel={deptLabel} />
    </div>
  );
}
