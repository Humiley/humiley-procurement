import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { PoList, type PoRow } from "@/components/po/PoList";

/** §8 PO register. Purchaser/Director/Accountant/Admin see all; others see their own POs. */
export default async function PurchaseOrdersPage() {
  const user = await requireUser();
  const canCreate = hasAnyRole(user, ["PURCHASER", "ADMIN"]);
  const seeAll = hasAnyRole(user, ["ADMIN", "PURCHASER", "DIRECTOR", "ACCOUNTANT"]);

  const pos = await db.purchaseOrder.findMany({
    where: seeAll ? {} : { createdById: user.id },
    orderBy: { createdAt: "desc" },
    include: { vendor: { select: { code: true, nameEn: true } }, pr: { select: { prNumber: true } } },
  });

  const rows: PoRow[] = pos.map((p) => ({
    id: p.id,
    poNumber: p.poNumber,
    vendor: `${p.vendor.code} · ${p.vendor.nameEn}`,
    prNumber: p.pr?.prNumber || "—",
    expectedDate: p.expectedDate ? formatVnDate(p.expectedDate) : "—",
    total: decToString(p.total, 0) ?? "0",
    status: p.status,
  }));

  return (
    <div className="space-y-4">
      <HowItWorks guide="purchase-orders" />
      <PoList rows={rows} canCreate={canCreate} />
    </div>
  );
}
