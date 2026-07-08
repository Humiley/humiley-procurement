import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { PrForm, type CostCenterOpt, type ExistingPr } from "@/components/pr/PrForm";
import type { CatalogItem, UomOpt, PrEditorLine } from "@/components/pr/PrLinesEditor";

export default async function EditRequisitionPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("pr");
  const tc = await getTranslations("common");

  const pr = await db.purchaseRequisition.findUnique({
    where: { id: params.id },
    include: { lines: true },
  });
  if (!pr) notFound();
  if (pr.requesterId !== user.id || pr.status !== "DRAFT") redirect(`/requisitions/${pr.id}`);

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

  const existing: ExistingPr = {
    id: pr.id,
    costCenterId: pr.costCenterId,
    neededByDate: pr.neededByDate.toISOString().slice(0, 10),
    purpose: pr.purpose,
    projectCode: pr.projectCode ?? "",
    lines: pr.lines.map<PrEditorLine>((l) => ({
      key: l.id,
      itemId: l.itemId ?? "",
      freeTextDescription: l.freeTextDescription ?? "",
      uomId: l.uomId,
      qty: decToString(l.qty, 4)?.replace(/\.?0+$/, "") ?? "1",
      unitPrice: decToString(l.estUnitPriceVnd, 0) ?? "",
      note: l.note ?? "",
      isCapex: l.isCapex,
    })),
  };

  return (
    <div className="space-y-4">
      <Link href={`/requisitions/${pr.id}`} className="btn-ghost -ml-3 w-fit">
        <ArrowLeft className="h-4 w-4" /> {tc("back")}
      </Link>
      <h1 className="text-xl font-bold text-navy">
        {t("edit")} · {pr.prNumber}
      </h1>
      <PrForm
        costCenters={ccOpts}
        items={itemOpts}
        uoms={uomOpts}
        departmentLabel={deptLabel}
        existing={existing}
      />
    </div>
  );
}
