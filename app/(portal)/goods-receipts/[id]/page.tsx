import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatQty } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { GrnAcceptForm, type GrnQcLine } from "@/components/grn/GrnAcceptForm";

export default async function GrnDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("grn");
  const st = await getTranslations("status");

  const grn = await db.goodsReceipt.findUnique({
    where: { id: params.id },
    include: {
      po: { select: { id: true, poNumber: true, status: true, vendor: { select: { code: true, nameEn: true } } } },
      warehouse: { select: { code: true, nameEn: true } },
      receivedBy: { select: { name: true } },
      lines: { include: { poLine: { select: { description: true, item: { select: { isLotTracked: true } } } }, lot: { select: { lotNumber: true, expiryDate: true } } } },
    },
  });
  if (!grn) notFound();
  const canSee = hasAnyRole(user, ["WAREHOUSE", "ADMIN", "PURCHASER", "ACCOUNTANT", "DIRECTOR", "DEPT_MANAGER"]);
  if (!canSee) notFound();

  const signatures = await db.electronicSignature.findMany({
    where: { entityType: "GoodsReceipt", entityId: grn.id },
    orderBy: { signedAt: "asc" },
  });

  const qcLines: GrnQcLine[] = grn.lines.map((l) => ({
    grnLineId: l.id,
    description: l.poLine.description,
    received: formatQty(l.qtyReceived),
    lotTracked: !!l.poLine.item?.isLotTracked,
  }));
  const hasLots = grn.lines.some((l) => l.lotId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/goods-receipts" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="page-title font-mono">{grn.grnNumber}</h1>
        <StatusBadge status={grn.status} label={st.has(grn.status) ? st(grn.status) : grn.status} />
        {hasLots ? (
          <a href={`/inventory/labels?grn=${grn.id}`} className="btn-outline">
            {t("printLabels")}
          </a>
        ) : null}
        <span className="ml-auto text-xs text-grey">
          {t("po")}: <Link className="font-mono text-navy hover:underline" href={`/purchase-orders/${grn.po.id}`}>{grn.po.poNumber}</Link>
          {" · "}{grn.po.vendor.code} · {grn.warehouse.code} · {formatVnDate(grn.receivedDate)} · {grn.receivedBy.name}
        </span>
      </div>

      <div className="overflow-x-auto card">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="th">
              <th className="px-3 py-2.5">{t("lineDesc")}</th>
              <th className="px-3 py-2.5 text-right">{t("received")}</th>
              <th className="px-3 py-2.5 text-right">{t("accepted")}</th>
              <th className="px-3 py-2.5 text-right">{t("rejected")}</th>
              <th className="px-3 py-2.5">{t("rejectReason")}</th>
              <th className="px-3 py-2.5">{t("lot")}</th>
            </tr>
          </thead>
          <tbody>
            {grn.lines.map((l) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5">{l.poLine.description}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatQty(l.qtyReceived)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-emerald">{formatQty(l.qtyAccepted)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-danger">{formatQty(l.qtyRejected)}</td>
                <td className="px-3 py-2.5 text-xs text-grey">{l.rejectReason || "—"}</td>
                <td className="px-3 py-2.5 font-mono text-xs">{l.lot ? l.lot.lotNumber : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {grn.status === "QC_PENDING" && hasAnyRole(user, ["WAREHOUSE", "ADMIN"]) ? (
        <GrnAcceptForm grnId={grn.id} grnNumber={grn.grnNumber} lines={qcLines} />
      ) : null}

      {signatures.length > 0 ? (
        <div>
          <h3 className="label">{t("signatureBlock")}</h3>
          <ul className="space-y-1.5">
            {signatures.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-navy">{s.fullNamePrinted}</span>
                <span className="mx-1.5 rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy">{s.meaning}</span>
                <span className="text-grey">{formatVnDateTime(s.signedAt)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {grn.notes ? <p className="text-sm text-grey">{t("notes")}: {grn.notes}</p> : null}
    </div>
  );
}
