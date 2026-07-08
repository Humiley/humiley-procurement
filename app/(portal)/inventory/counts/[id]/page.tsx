import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDate, formatVnDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { CountSheet, type CountLineRow } from "@/components/inv/CountSheet";

export default async function CountDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("cnt");
  const st = await getTranslations("status");

  const count = await db.stockCount.findUnique({
    where: { id: params.id },
    include: {
      warehouse: { select: { code: true, nameEn: true } },
      lines: { include: { item: { select: { code: true, nameEn: true, uom: { select: { code: true } } } } } },
    },
  });
  if (!count) notFound();

  const signatures = await db.electronicSignature.findMany({
    where: { entityType: "StockCount", entityId: count.id },
    orderBy: { signedAt: "asc" },
  });

  const rows: CountLineRow[] = count.lines.map((l) => ({
    lineId: l.id,
    label: `${l.item.code} · ${l.item.nameEn}`,
    uom: l.item.uom.code,
    systemQty: decToString(l.systemQty, 4) ?? "0",
    countedQty: decToString(l.countedQty, 4) ?? "0",
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory/counts" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="font-mono text-lg font-bold text-navy">{count.countNumber}</h1>
        <StatusBadge status={count.status} label={st.has(count.status) ? st(count.status) : count.status} />
        <span className="rounded bg-navy/10 px-2 py-0.5 text-xs font-bold text-navy">{count.warehouse.code}</span>
        <span className="text-sm text-grey">{formatVnDate(count.countDate)}</span>
      </div>

      <CountSheet
        id={count.id}
        status={count.status}
        canEdit={hasAnyRole(user, ["WAREHOUSE", "ADMIN"])}
        canPost={hasAnyRole(user, ["DIRECTOR", "ADMIN"])}
        lines={rows}
      />

      {signatures.length > 0 ? (
        <div className="rounded-xl border border-grey/20 bg-white p-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-grey">{t("signatures")}</h3>
          <ul className="space-y-1.5">
            {signatures.map((s) => (
              <li key={s.id} className="rounded-lg border border-grey/15 bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-navy">{s.fullNamePrinted}</span>
                <span className="mx-1.5 rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy">{s.meaning}</span>
                <span className="text-grey">{formatVnDateTime(s.signedAt)}</span>
                {s.reason ? <span className="ml-1.5 text-grey">— {s.reason}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
