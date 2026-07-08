import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString, formatQty } from "@/lib/money";
import { formatVnDate } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { RfqDetail, type RfqLineRow, type RfqVendorCol } from "@/components/rfq/RfqDetail";

export default async function RfqDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("rfq");
  const st = await getTranslations("status");

  const rfq = await db.rfq.findUnique({
    where: { id: params.id },
    include: {
      pr: { select: { id: true, prNumber: true, totalEstimatedVnd: true } },
      lines: true,
      vendors: { include: { vendor: { select: { code: true, nameEn: true } } } },
      quotes: { include: { lines: true } },
    },
  });
  if (!rfq) notFound();
  const canSee = hasAnyRole(user, ["PURCHASER", "ADMIN", "DIRECTOR", "ACCOUNTANT", "DEPT_MANAGER"]);
  if (!canSee) notFound();

  const uomIds = rfq.lines.map((l) => l.uomId).filter((v): v is string => !!v);
  const itemIds = rfq.lines.map((l) => l.itemId).filter((v): v is string => !!v);
  const [uoms, items] = await Promise.all([
    uomIds.length ? db.uom.findMany({ where: { id: { in: uomIds } } }) : [],
    itemIds.length ? db.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, nameEn: true } }) : [],
  ]);
  const uomById = new Map(uoms.map((u) => [u.id, u.code]));
  const itemById = new Map(items.map((it) => [it.id, it]));

  const lines: RfqLineRow[] = rfq.lines.map((l, i) => ({
    id: l.id,
    no: i + 1,
    description: l.itemId && itemById.get(l.itemId) ? `${itemById.get(l.itemId)!.code} · ${itemById.get(l.itemId)!.nameEn}` : l.description,
    uom: (l.uomId && uomById.get(l.uomId)) || "",
    qty: formatQty(l.qty),
    qtyNum: Number(l.qty),
  }));

  const quoteByVendor = new Map(rfq.quotes.map((q) => [q.vendorId, q]));
  const vendors: RfqVendorCol[] = rfq.vendors.map((rv) => {
    const q = quoteByVendor.get(rv.vendorId);
    return {
      vendorId: rv.vendorId,
      code: rv.vendor.code,
      nameEn: rv.vendor.nameEn,
      sentAt: rv.sentAt ? formatVnDate(rv.sentAt) : null,
      respondedAt: rv.respondedAt ? formatVnDate(rv.respondedAt) : null,
      quote: q
        ? {
            id: q.id,
            totalVnd: decToString(q.totalVnd, 2) ?? "0",
            leadTimeDays: q.leadTimeDays,
            paymentTerms: q.paymentTerms,
            validUntil: q.validUntil ? formatVnDate(q.validUntil) : null,
            priceByLine: Object.fromEntries(q.lines.map((ql) => [ql.rfqLineId, decToString(ql.unitPrice, 2) ?? "0"])),
          }
        : null,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/rfqs" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="font-mono text-lg font-bold text-navy">{rfq.rfqNumber}</h1>
        <StatusBadge status={rfq.status} label={st.has(rfq.status) ? st(rfq.status) : rfq.status} />
        <span className="text-sm text-grey">{rfq.title}</span>
        <span className="ml-auto text-xs text-grey">
          {t("dueDate")}: <b>{formatVnDate(rfq.dueDate)}</b>
          {rfq.pr ? <> · {t("colPr")}: <Link className="font-mono text-navy hover:underline" href={`/requisitions/${rfq.pr.id}`}>{rfq.pr.prNumber}</Link></> : null}
        </span>
      </div>

      <RfqDetail
        rfqId={rfq.id}
        status={rfq.status}
        estimateVnd={Number(rfq.pr?.totalEstimatedVnd ?? 0)}
        lines={lines}
        vendors={vendors}
        canManage={hasAnyRole(user, ["PURCHASER", "ADMIN"])}
      />
    </div>
  );
}
