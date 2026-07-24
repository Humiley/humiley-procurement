import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { ContractList, type ContractRow } from "@/components/contract/ContractList";
import { checkContractRenewals } from "./actions";

const DAY = 24 * 3600 * 1000;

/** §9 contract register — renewal alerts run on load; expiring rows are badged. */
export default async function ContractsPage() {
  const user = await requireUser();
  const canCreate = hasAnyRole(user, ["PURCHASER", "ADMIN"]);

  await checkContractRenewals();

  const contracts = await db.contract.findMany({
    orderBy: { endDate: "asc" },
    include: { vendor: { select: { code: true, nameEn: true } }, _count: { select: { purchaseOrders: true } } },
  });
  const now = Date.now();

  const rows: ContractRow[] = contracts.map((c) => {
    const daysLeft = Math.ceil((c.endDate.getTime() - now) / DAY);
    return {
      id: c.id,
      contractNumber: c.contractNumber,
      vendorCode: c.vendor.code,
      vendorName: c.vendor.nameEn,
      title: c.title,
      startDate: formatVnDate(c.startDate),
      endDate: formatVnDate(c.endDate),
      expiring: c.status === "ACTIVE" && daysLeft <= c.renewalAlertDays,
      daysLeft,
      value: decToString(c.valueVnd, 0) ?? "0",
      poCount: c._count.purchaseOrders,
      status: c.status,
    };
  });

  return (
    <div className="space-y-4">
      <ContractList rows={rows} canCreate={canCreate} />
    </div>
  );
}
