import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";

const IN_TYPES = new Set(["GRN_IN", "TRANSFER_IN", "ADJUST_IN", "RETURN_IN"]);

/** §21 trace — backward (lot → GRN → PO → vendor) and forward (every consumption with its cost center). */
export default async function TracePage({ params }: { params: { lotId: string } }) {
  await requireUser();
  const t = await getTranslations("trace");
  const ti = await getTranslations("inventory.type");

  const lot = await db.lot.findUnique({
    where: { id: params.lotId },
    include: {
      item: { select: { code: true, nameEn: true, uom: { select: { code: true } } } },
      vendor: { select: { code: true, nameEn: true } },
      grn: {
        select: {
          id: true,
          grnNumber: true,
          receivedDate: true,
          receivedBy: { select: { name: true } },
          po: { select: { id: true, poNumber: true, vendor: { select: { code: true, nameEn: true } }, pr: { select: { id: true, prNumber: true } } } },
        },
      },
      stockBalances: { include: { warehouse: { select: { code: true } } } },
      movements: { orderBy: { postedAt: "asc" }, include: { warehouse: { select: { code: true } }, createdBy: { select: { name: true } } } },
    },
  });
  if (!lot) notFound();

  // forward: resolve each ISSUE_OUT's goods issue for cost center / department context
  const issueIds = Array.from(new Set(lot.movements.filter((m) => m.type === "ISSUE_OUT" && m.refEntityType === "GoodsIssue").map((m) => m.refEntityId!)));
  const issues = issueIds.length
    ? await db.goodsIssue.findMany({
        where: { id: { in: issueIds } },
        select: {
          id: true,
          issueNumber: true,
          purpose: true,
          projectCode: true,
          costCenter: { select: { code: true, nameEn: true } },
          department: { select: { code: true } },
          requester: { select: { name: true } },
        },
      })
    : [];
  const issueById = new Map(issues.map((g) => [g.id, g]));

  const backward: { labelKey: string; value: string; href?: string }[] = [
    { labelKey: "lot", value: `${lot.lotNumber}${lot.expiryDate ? ` · EXP ${formatVnDate(lot.expiryDate)}` : ""}` },
    { labelKey: "item", value: `${lot.item.code} · ${lot.item.nameEn}` },
  ];
  if (lot.grn) backward.push({ labelKey: "grn", value: `${lot.grn.grnNumber} · ${formatVnDate(lot.grn.receivedDate)} · ${lot.grn.receivedBy.name}`, href: `/goods-receipts/${lot.grn.id}` });
  if (lot.grn?.po) backward.push({ labelKey: "po", value: lot.grn.po.poNumber, href: `/purchase-orders/${lot.grn.po.id}` });
  if (lot.grn?.po.pr) backward.push({ labelKey: "pr", value: lot.grn.po.pr.prNumber, href: `/requisitions/${lot.grn.po.pr.id}` });
  const vendor = lot.vendor ?? lot.grn?.po.vendor ?? null;
  if (vendor) backward.push({ labelKey: "vendor", value: `${vendor.code} · ${vendor.nameEn}` });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/scan" className="text-sm text-grey hover:text-navy">← {t("backToScan")}</Link>
        <h1 className="page-title">{t("title")}</h1>
        <span className="rounded bg-navy/10 px-2 py-0.5 font-mono text-sm font-bold text-navy">{lot.lotNumber}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-grey">{t("backward")}</h3>
          <ol className="relative space-y-0 border-l-2 border-emerald/40 pl-4">
            {backward.map((step, i) => (
              <li key={i} className="relative pb-4 last:pb-0">
                <span className="absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-emerald bg-white" />
                <div className="text-[10px] font-bold uppercase tracking-wide text-grey">{t(`step.${step.labelKey}`)}</div>
                {step.href ? (
                  <Link href={step.href} className="text-sm font-semibold text-navy hover:underline">{step.value}</Link>
                ) : (
                  <div className="text-sm font-semibold text-body">{step.value}</div>
                )}
              </li>
            ))}
          </ol>
          <div className="mt-4 border-t border-line pt-3">
            <h4 className="mb-1 text-[10px] font-bold uppercase tracking-wide text-grey">{t("currentStock")}</h4>
            {lot.stockBalances.filter((b) => Number(b.qtyOnHand) !== 0).length === 0 ? (
              <p className="text-sm text-grey">{t("fullyConsumed")}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {lot.stockBalances.filter((b) => Number(b.qtyOnHand) !== 0).map((b) => (
                  <li key={b.id} className="flex justify-between">
                    <span className="font-semibold">{b.warehouse.code}</span>
                    <span className="tabular-nums">{Number(decToString(b.qtyOnHand, 4)).toLocaleString("en-US")} {lot.item.uom.code}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-grey">{t("forward")}</h3>
          {lot.movements.length === 0 ? (
            <p className="text-sm text-grey">{t("noMovements")}</p>
          ) : (
            <ol className="space-y-2">
              {lot.movements.map((m) => {
                const gi = m.refEntityType === "GoodsIssue" ? issueById.get(m.refEntityId ?? "") : null;
                return (
                  <li key={m.id} className="rounded-lg border border-line px-3 py-2 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${IN_TYPES.has(m.type) ? "bg-emerald/10 text-emerald" : "bg-danger/10 text-danger"}`}>{ti(m.type)}</span>
                      <span className="font-mono text-xs font-bold text-navy">{m.movementNumber}</span>
                      <span className="tabular-nums">{Number(decToString(m.qty, 4)).toLocaleString("en-US")} {lot.item.uom.code}</span>
                      <span className="text-xs text-grey">{m.warehouse.code} · {formatVnDateTime(m.postedAt)} · {m.createdBy.name}</span>
                    </div>
                    {gi ? (
                      <p className="mt-1 text-xs text-grey">
                        <Link href={`/inventory/issues/${gi.id}`} className="font-mono font-bold text-navy hover:underline">{gi.issueNumber}</Link>
                        {" → "}{gi.costCenter.code} · {gi.costCenter.nameEn} ({gi.department.code}{gi.projectCode ? ` · ${gi.projectCode}` : ""}) — {gi.purpose} — {gi.requester.name}
                      </p>
                    ) : m.note ? (
                      <p className="mt-1 font-mono text-xs text-grey">{m.note}</p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
