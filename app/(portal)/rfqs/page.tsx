import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { HowItWorks } from "@/components/shared/HowItWorks";
import { formatVnDate } from "@/lib/dates";
import { RfqList, type RfqRow } from "@/components/rfq/RfqList";

/** §8 RFQ register. */
export default async function RfqsPage() {
  const user = await requireUser();
  const canCreate = hasAnyRole(user, ["PURCHASER", "ADMIN"]);

  const rfqs = await db.rfq.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      pr: { select: { prNumber: true } },
      vendors: { select: { respondedAt: true } },
      quotes: { select: { id: true } },
    },
  });

  const rows: RfqRow[] = rfqs.map((r) => ({
    id: r.id,
    rfqNumber: r.rfqNumber,
    title: r.title,
    prNumber: r.pr?.prNumber || "—",
    dueDate: formatVnDate(r.dueDate),
    quoteCount: r.quotes.length,
    vendorCount: r.vendors.length,
    status: r.status,
  }));

  return (
    <div className="space-y-4">
      <HowItWorks guide="rfqs" />
      <RfqList rows={rows} canCreate={canCreate} />
    </div>
  );
}
