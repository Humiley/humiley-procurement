import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const D = Prisma.Decimal;
const DAY = 24 * 3600 * 1000;

/** §10-G manager dashboard data — KPIs + Recharts series, computed server-side in one pass. */
export type ManagerDashboard = {
  spendMtd: number;
  spendYtd: number;
  openPos: number;
  pendingApprovals: number;
  cycleTimeDays: string;          // avg PR submit → PO create
  savingsVnd: number;             // awarded vs highest quote across awarded RFQs
  monthlyTrend: { month: string; spend: number }[];
  byCategory: { name: string; value: number }[];
  byDepartment: { name: string; value: number }[];
  topVendors: { name: string; value: number }[];
  deliveriesDue: { id: string; poNumber: string; vendor: string; expected: Date }[];
  expiringContracts: { id: string; contractNumber: string; vendor: string; endDate: Date; daysLeft: number }[];
};

export async function managerDashboard(userId: string): Promise<ManagerDashboard> {
  const now = new Date();
  const fyStart = new Date(now.getFullYear(), 0, 1);
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekAhead = new Date(now.getTime() + 7 * DAY);

  const [invoices, openPos, pendingApprovals, pos, quotes, duePos, contracts] = await Promise.all([
    db.invoice.findMany({
      where: { invoiceDate: { gte: fyStart } },
      include: {
        vendor: { select: { code: true } },
        po: { include: { pr: { include: { department: { select: { code: true } } } } } },
        lines: { include: { poLine: { include: { item: { include: { category: { select: { code: true } } } } } } } },
      },
    }),
    db.purchaseOrder.count({ where: { status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } } }),
    db.approvalStep.count({ where: { approverId: userId, status: "PENDING" } }),
    db.purchaseOrder.findMany({ where: { prId: { not: null }, createdAt: { gte: fyStart } }, include: { pr: { select: { createdAt: true } } } }),
    db.quote.findMany({ where: { rfq: { status: "AWARDED" } }, select: { rfqId: true, totalVnd: true, isSelected: true } }),
    db.purchaseOrder.findMany({
      where: { status: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] }, expectedDate: { gte: now, lte: weekAhead } },
      include: { vendor: { select: { code: true, nameEn: true } } },
      orderBy: { expectedDate: "asc" },
    }),
    db.contract.findMany({ where: { status: "ACTIVE" }, include: { vendor: { select: { code: true } } } }),
  ]);

  let spendMtd = new D(0), spendYtd = new D(0);
  const trend = new Map<string, Prisma.Decimal>();
  const byCat = new Map<string, Prisma.Decimal>();
  const byDept = new Map<string, Prisma.Decimal>();
  const byVendor = new Map<string, Prisma.Decimal>();
  for (let m = 0; m <= now.getMonth(); m++) trend.set(`${String(m + 1).padStart(2, "0")}/${now.getFullYear()}`, new D(0));
  for (const i of invoices) {
    spendYtd = spendYtd.plus(i.subtotal);   // ex-VAT, consistent with the category donut
    if (i.invoiceDate >= mStart) spendMtd = spendMtd.plus(i.subtotal);
    const mk = `${String(i.invoiceDate.getMonth() + 1).padStart(2, "0")}/${i.invoiceDate.getFullYear()}`;
    trend.set(mk, (trend.get(mk) ?? new D(0)).plus(i.subtotal));
    const dept = i.po.pr?.department.code ?? "—";
    byDept.set(dept, (byDept.get(dept) ?? new D(0)).plus(i.subtotal));
    byVendor.set(i.vendor.code, (byVendor.get(i.vendor.code) ?? new D(0)).plus(i.subtotal));
    for (const l of i.lines) {
      const cat = l.poLine.item?.category.code ?? "—";
      byCat.set(cat, (byCat.get(cat) ?? new D(0)).plus(l.amount));
    }
  }

  const cycles = pos.filter((p) => p.pr).map((p) => (p.createdAt.getTime() - p.pr!.createdAt.getTime()) / DAY);
  const cycleTimeDays = cycles.length ? (cycles.reduce((s, v) => s + v, 0) / cycles.length).toFixed(1) : "—";

  // savings: per awarded RFQ, highest quote − selected quote
  const byRfq = new Map<string, { max: Prisma.Decimal; sel: Prisma.Decimal | null }>();
  for (const q of quotes) {
    const e = byRfq.get(q.rfqId) ?? { max: new D(0), sel: null };
    if (new D(q.totalVnd).greaterThan(e.max)) e.max = new D(q.totalVnd);
    if (q.isSelected) e.sel = new D(q.totalVnd);
    byRfq.set(q.rfqId, e);
  }
  let savings = new D(0);
  for (const e of Array.from(byRfq.values())) if (e.sel) savings = savings.plus(e.max.minus(e.sel));

  const sortDesc = (m: Map<string, Prisma.Decimal>) =>
    Array.from(m.entries()).map(([name, v]) => ({ name, value: Number(v) })).sort((a, b) => b.value - a.value);

  return {
    spendMtd: Number(spendMtd),
    spendYtd: Number(spendYtd),
    openPos,
    pendingApprovals,
    cycleTimeDays,
    savingsVnd: Number(savings),
    monthlyTrend: Array.from(trend.entries()).map(([month, v]) => ({ month, spend: Number(v) })),
    byCategory: sortDesc(byCat),
    byDepartment: sortDesc(byDept),
    topVendors: sortDesc(byVendor).slice(0, 10),
    deliveriesDue: duePos.map((p) => ({ id: p.id, poNumber: p.poNumber, vendor: `${p.vendor.code} · ${p.vendor.nameEn}`, expected: p.expectedDate! })),
    expiringContracts: contracts
      .map((c) => ({ id: c.id, contractNumber: c.contractNumber, vendor: c.vendor.code, endDate: c.endDate, daysLeft: Math.ceil((c.endDate.getTime() - now.getTime()) / DAY) }))
      .filter((c) => c.daysLeft <= 90)
      .sort((a, b) => a.daysLeft - b.daysLeft),
  };
}
