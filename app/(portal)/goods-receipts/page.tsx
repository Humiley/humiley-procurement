import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { formatVnDate } from "@/lib/dates";
import { GrnList, type GrnRow } from "@/components/grn/GrnList";

/** §9 GRN register. */
export default async function GoodsReceiptsPage() {
  const user = await requireUser();
  const canCreate = hasAnyRole(user, ["WAREHOUSE", "ADMIN"]);

  const grns = await db.goodsReceipt.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      po: { select: { poNumber: true, vendor: { select: { code: true } } } },
      warehouse: { select: { code: true } },
      receivedBy: { select: { name: true } },
      lines: { select: { qtyReceived: true } },
    },
  });

  const rows: GrnRow[] = grns.map((g) => ({
    id: g.id,
    grnNumber: g.grnNumber,
    po: `${g.po.poNumber} · ${g.po.vendor.code}`,
    warehouse: g.warehouse.code,
    receivedBy: g.receivedBy.name,
    receivedDate: formatVnDate(g.receivedDate),
    qty: g.lines.reduce((s, l) => s + Number(l.qtyReceived), 0),
    status: g.status,
  }));

  return (
    <div className="space-y-4">
      <HowItWorks guide="goods-receipts" />
      <GrnList rows={rows} canCreate={canCreate} />
    </div>
  );
}
