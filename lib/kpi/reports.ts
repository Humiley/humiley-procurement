import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

const D = Prisma.Decimal;
const DAY = 24 * 3600 * 1000;

/**
 * §10-G report registry — one data function per report, consumed by BOTH the /reports/[key]
 * pages and the xlsx export route so the file always matches the screen. Column headers are
 * i18n keys under `reports.cols.*`; cells are plain strings/numbers (money pre-grouped).
 */

export type ReportTable = { columns: string[]; rows: (string | number)[][] };
export type ReportDef = { fn: (fy: number) => Promise<ReportTable> };

const money = (v: unknown) => Number(new D((v as never) ?? 0).toFixed(0)).toLocaleString("en-US");
const pct = (num: number, den: number) => (den > 0 ? `${Math.round((num / den) * 100)}%` : "—");
const fyRange = (fy: number) => ({ gte: new Date(`${fy}-01-01T00:00:00`), lt: new Date(`${fy + 1}-01-01T00:00:00`) });

async function spendByVendor(fy: number): Promise<ReportTable> {
  const invoices = await db.invoice.findMany({ where: { invoiceDate: fyRange(fy) }, include: { vendor: { select: { code: true, nameEn: true } } } });
  const agg = new Map<string, { count: number; total: Prisma.Decimal }>();
  for (const i of invoices) {
    const k = `${i.vendor.code} · ${i.vendor.nameEn}`;
    const e = agg.get(k) ?? { count: 0, total: new D(0) };
    agg.set(k, { count: e.count + 1, total: e.total.plus(i.total) });
  }
  return {
    columns: ["vendor", "invoices", "amount"],
    rows: Array.from(agg.entries()).sort((a, b) => Number(b[1].total) - Number(a[1].total)).map(([k, v]) => [k, v.count, money(v.total)]),
  };
}

async function spendByCategory(fy: number): Promise<ReportTable> {
  const lines = await db.invoiceLine.findMany({
    where: { invoice: { invoiceDate: fyRange(fy) } },
    include: { poLine: { include: { item: { include: { category: { select: { code: true, nameEn: true } } } } } } },
  });
  const agg = new Map<string, Prisma.Decimal>();
  for (const l of lines) {
    const k = l.poLine.item?.category ? `${l.poLine.item.category.code} · ${l.poLine.item.category.nameEn}` : "—";
    agg.set(k, (agg.get(k) ?? new D(0)).plus(l.amount));
  }
  return { columns: ["category", "amount"], rows: Array.from(agg.entries()).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k, v]) => [k, money(v)]) };
}

async function spendByDepartment(fy: number): Promise<ReportTable> {
  const invoices = await db.invoice.findMany({
    where: { invoiceDate: fyRange(fy) },
    include: { po: { include: { pr: { include: { department: { select: { code: true, nameEn: true } } } } } } },
  });
  const agg = new Map<string, Prisma.Decimal>();
  for (const i of invoices) {
    const k = i.po.pr ? `${i.po.pr.department.code} · ${i.po.pr.department.nameEn}` : "—";
    agg.set(k, (agg.get(k) ?? new D(0)).plus(i.total));
  }
  return { columns: ["department", "amount"], rows: Array.from(agg.entries()).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k, v]) => [k, money(v)]) };
}

async function spendByProject(fy: number): Promise<ReportTable> {
  const invoices = await db.invoice.findMany({
    where: { invoiceDate: fyRange(fy) },
    include: { po: { include: { pr: { select: { projectCode: true } } } } },
  });
  const agg = new Map<string, Prisma.Decimal>();
  for (const i of invoices) {
    const k = i.po.pr?.projectCode || "—";
    agg.set(k, (agg.get(k) ?? new D(0)).plus(i.total));
  }
  return { columns: ["project", "amount"], rows: Array.from(agg.entries()).sort((a, b) => Number(b[1]) - Number(a[1])).map(([k, v]) => [k, money(v)]) };
}

async function prRegister(fy: number): Promise<ReportTable> {
  const prs = await db.purchaseRequisition.findMany({
    where: { createdAt: fyRange(fy) },
    orderBy: { createdAt: "desc" },
    include: { requester: { select: { name: true } }, department: { select: { code: true } }, costCenter: { select: { code: true } } },
  });
  return {
    columns: ["number", "date", "requester", "department", "costCenter", "purpose", "amount", "status"],
    rows: prs.map((p) => [p.prNumber, p.createdAt.toISOString().slice(0, 10), p.requester.name, p.department.code, p.costCenter.code, p.purpose, money(p.totalEstimatedVnd), p.status]),
  };
}

async function poRegister(fy: number): Promise<ReportTable> {
  const pos = await db.purchaseOrder.findMany({
    where: { createdAt: fyRange(fy) },
    orderBy: { createdAt: "desc" },
    include: { vendor: { select: { code: true, nameEn: true } }, pr: { select: { prNumber: true } } },
  });
  return {
    columns: ["number", "date", "vendor", "sourcePr", "amount", "status"],
    rows: pos.map((p) => [p.poNumber, p.createdAt.toISOString().slice(0, 10), `${p.vendor.code} · ${p.vendor.nameEn}`, p.pr?.prNumber ?? "—", money(p.total), p.status]),
  };
}

async function grnRegister(fy: number): Promise<ReportTable> {
  const grns = await db.goodsReceipt.findMany({
    where: { receivedDate: fyRange(fy) },
    orderBy: { receivedDate: "desc" },
    include: { po: { select: { poNumber: true } }, warehouse: { select: { code: true } }, receivedBy: { select: { name: true } }, lines: { select: { qtyAccepted: true, qtyRejected: true } } },
  });
  return {
    columns: ["number", "date", "po", "warehouse", "receivedBy", "accepted", "rejected", "status"],
    rows: grns.map((g) => [
      g.grnNumber,
      g.receivedDate.toISOString().slice(0, 10),
      g.po.poNumber,
      g.warehouse.code,
      g.receivedBy.name,
      g.lines.reduce((s, l) => s + Number(l.qtyAccepted), 0),
      g.lines.reduce((s, l) => s + Number(l.qtyRejected), 0),
      g.status,
    ]),
  };
}

async function invoiceAging(): Promise<ReportTable> {
  const invoices = await db.invoice.findMany({
    where: { paymentStatus: { not: "PAID" } },
    orderBy: { dueDate: "asc" },
    include: { vendor: { select: { code: true } } },
  });
  const now = Date.now();
  const bucket = (days: number) => (days <= 0 ? "current" : days <= 30 ? "0-30" : days <= 60 ? "31-60" : days <= 90 ? "61-90" : "90+");
  return {
    columns: ["number", "vendor", "dueDate", "amount", "daysOverdue", "bucket"],
    rows: invoices.map((i) => {
      const overdue = Math.max(0, Math.floor((now - i.dueDate.getTime()) / DAY));
      return [i.invoiceNumber, i.vendor.code, i.dueDate.toISOString().slice(0, 10), money(i.total), overdue, bucket(overdue)];
    }),
  };
}

async function vendorPerformance(fy: number): Promise<ReportTable> {
  const vendors = await db.vendor.findMany({
    where: { status: "APPROVED" },
    include: {
      purchaseOrders: { where: { createdAt: fyRange(fy) }, select: { id: true, expectedDate: true, goodsReceipts: { select: { receivedDate: true, lines: { select: { qtyAccepted: true, qtyRejected: true } } } } } },
    },
  });
  return {
    columns: ["vendor", "pos", "grns", "onTimeRate", "rejectRate"],
    rows: vendors.map((v) => {
      const grns = v.purchaseOrders.flatMap((p) => p.goodsReceipts.map((g) => ({ ...g, expected: p.expectedDate })));
      const timed = grns.filter((g) => g.expected);
      const onTime = timed.filter((g) => g.receivedDate <= g.expected!).length;
      const acc = grns.flatMap((g) => g.lines).reduce((s, l) => s + Number(l.qtyAccepted), 0);
      const rej = grns.flatMap((g) => g.lines).reduce((s, l) => s + Number(l.qtyRejected), 0);
      return [`${v.code} · ${v.nameEn}`, v.purchaseOrders.length, grns.length, pct(onTime, timed.length), pct(rej, acc + rej)];
    }),
  };
}

async function budgetVsActual(fy: number): Promise<ReportTable> {
  const budgets = await db.budget.findMany({
    where: { fiscalYear: fy },
    include: { costCenter: { select: { code: true } }, category: { select: { code: true } } },
    orderBy: [{ costCenter: { code: "asc" } }, { category: { code: "asc" } }],
  });
  return {
    columns: ["costCenter", "category", "budget", "committed", "spent", "remaining", "utilization"],
    rows: budgets.map((b) => {
      const remaining = new D(b.amountVnd).minus(b.committedVnd).minus(b.spentVnd);
      const used = Number(b.committedVnd) + Number(b.spentVnd);
      return [b.costCenter.code, b.category.code, money(b.amountVnd), money(b.committedVnd), money(b.spentVnd), money(remaining), pct(used, Number(b.amountVnd))];
    }),
  };
}

async function approvalCycleTime(fy: number): Promise<ReportTable> {
  const steps = await db.approvalStep.findMany({
    where: { decidedAt: { not: null }, createdAt: fyRange(fy) },
    select: { entityType: true, createdAt: true, decidedAt: true },
  });
  const agg = new Map<string, { n: number; totalDays: number }>();
  for (const s of steps) {
    const days = (s.decidedAt!.getTime() - s.createdAt.getTime()) / DAY;
    const e = agg.get(s.entityType) ?? { n: 0, totalDays: 0 };
    agg.set(s.entityType, { n: e.n + 1, totalDays: e.totalDays + days });
  }
  return {
    columns: ["entityType", "decisions", "avgDays"],
    rows: Array.from(agg.entries()).map(([k, v]) => [k, v.n, (v.totalDays / v.n).toFixed(2)]),
  };
}

async function paymentAging(): Promise<ReportTable> {
  const reqs = await db.paymentRequest.findMany({
    where: { status: "APPROVED" },
    orderBy: { dueDate: "asc" },
    include: { requester: { select: { name: true } } },
  });
  const now = Date.now();
  return {
    columns: ["number", "payee", "requester", "dueDate", "amount", "daysToDue"],
    rows: reqs.map((r) => [
      r.paymentRequestNumber,
      r.payeeName,
      r.requester.name,
      r.dueDate ? r.dueDate.toISOString().slice(0, 10) : "—",
      money(r.amount),
      r.dueDate ? Math.floor((r.dueDate.getTime() - now) / DAY) : "—",
    ]),
  };
}

async function outstandingAdvances(): Promise<ReportTable> {
  const advances = await db.paymentRequest.findMany({
    where: { type: "ADVANCE", status: "PAID" },
    include: { requester: { select: { name: true } }, settlements: { where: { status: { in: ["SUBMITTED", "APPROVED", "PAID"] } }, select: { id: true } } },
    orderBy: { paidDate: "asc" },
  });
  const now = Date.now();
  return {
    columns: ["number", "requester", "amount", "paidDate", "daysOutstanding"],
    rows: advances
      .filter((a) => a.settlements.length === 0)
      .map((a) => [
        a.paymentRequestNumber,
        a.requester.name,
        money(a.amount),
        a.paidDate ? a.paidDate.toISOString().slice(0, 10) : "—",
        a.paidDate ? Math.floor((now - a.paidDate.getTime()) / DAY) : "—",
      ]),
  };
}

async function inventoryValue(): Promise<ReportTable> {
  const balances = await db.stockBalance.findMany({
    where: { qtyOnHand: { gt: 0 } },
    include: {
      warehouse: { select: { code: true } },
      item: { include: { category: { select: { code: true } }, uom: { select: { code: true } } } },
    },
    orderBy: [{ warehouseId: "asc" }, { itemId: "asc" }],
  });
  return {
    columns: ["warehouse", "item", "category", "onHand", "avgCost", "value"],
    rows: balances.map((b) => [
      b.warehouse.code,
      `${b.item.code} · ${b.item.nameEn}`,
      b.item.category?.code ?? "—",
      `${Number(b.qtyOnHand).toLocaleString("en-US")} ${b.item.uom.code}`,
      money(b.avgCostVnd),
      money(new D(b.qtyOnHand).times(b.avgCostVnd)),
    ]),
  };
}

export const REPORTS: Record<string, ReportDef> = {
  "spend-by-vendor": { fn: spendByVendor },
  "spend-by-category": { fn: spendByCategory },
  "spend-by-department": { fn: spendByDepartment },
  "spend-by-project": { fn: spendByProject },
  "pr-register": { fn: prRegister },
  "po-register": { fn: poRegister },
  "grn-register": { fn: grnRegister },
  "invoice-aging": { fn: () => invoiceAging() },
  "vendor-performance": { fn: vendorPerformance },
  "budget-vs-actual": { fn: budgetVsActual },
  "approval-cycle-time": { fn: approvalCycleTime },
  "payment-aging": { fn: () => paymentAging() },
  "outstanding-advances": { fn: () => outstandingAdvances() },
  "inventory-value": { fn: () => inventoryValue() },
};
export const REPORT_KEYS = Object.keys(REPORTS);
