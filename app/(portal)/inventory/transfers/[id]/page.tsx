import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser, hasAnyRole } from "@/lib/rbac";
import { db } from "@/lib/db";
import { decToString } from "@/lib/money";
import { formatVnDateTime } from "@/lib/dates";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TransferDetailActions } from "@/components/inv/TransferDetailActions";

export default async function TransferDetailPage({ params }: { params: { id: string } }) {
  const user = await requireUser();
  const t = await getTranslations("trf");
  const ti = await getTranslations("inventory.type");
  const st = await getTranslations("status");

  const trf = await db.stockTransfer.findUnique({
    where: { id: params.id },
    include: {
      fromWarehouse: { select: { code: true, nameEn: true } },
      toWarehouse: { select: { code: true, nameEn: true } },
      createdBy: { select: { name: true } },
      receivedBy: { select: { name: true } },
      lines: { include: { item: { select: { code: true, nameEn: true, uom: { select: { code: true } } } } } },
    },
  });
  if (!trf) notFound();

  const [signatures, movements] = await Promise.all([
    db.electronicSignature.findMany({ where: { entityType: "StockTransfer", entityId: trf.id }, orderBy: { signedAt: "asc" } }),
    db.stockMovement.findMany({ where: { refEntityType: "StockTransfer", refEntityId: trf.id }, orderBy: { postedAt: "asc" } }),
  ]);
  const canAct = hasAnyRole(user, ["WAREHOUSE", "ADMIN"]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/inventory/transfers" className="text-sm text-grey hover:text-navy">← {t("listTitle")}</Link>
        <h1 className="page-title tabular-nums">{trf.transferNumber}</h1>
        <StatusBadge status={trf.status} label={st.has(trf.status) ? st(trf.status) : trf.status} />
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 card p-4 text-sm sm:grid-cols-4">
        <Field label={t("from")} value={`${trf.fromWarehouse.code} · ${trf.fromWarehouse.nameEn}`} />
        <Field label={t("to")} value={`${trf.toWarehouse.code} · ${trf.toWarehouse.nameEn}`} />
        <Field label={t("colBy")} value={trf.createdBy.name} />
        <Field label={t("receivedBy")} value={trf.receivedBy?.name || "—"} />
      </div>

      <TransferDetailActions id={trf.id} status={trf.status} canAct={canAct} />

      <div className="overflow-x-auto card">
        <table className="w-full min-w-[480px] text-sm">
          <thead>
            <tr className="th">
              <th className="w-8 px-3 py-2.5">#</th>
              <th className="px-3 py-2.5">{t("item")}</th>
              <th className="px-3 py-2.5 text-right">{t("qty")}</th>
            </tr>
          </thead>
          <tbody>
            {trf.lines.map((l, i) => (
              <tr key={l.id} className="border-b border-line last:border-0">
                <td className="px-3 py-2.5 text-grey">{i + 1}</td>
                <td className="px-3 py-2.5">{l.item.code} · {l.item.nameEn}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{Number(decToString(l.qty, 4)).toLocaleString("en-US")} {l.item.uom.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {movements.length > 0 ? (
        <div className="card p-4">
          <h3 className="label">{t("movements")}</h3>
          <ul className="space-y-1.5 text-xs">
            {movements.map((m) => (
              <li key={m.id} className="font-mono">
                {m.movementNumber} · {ti(m.type)} · {Number(decToString(m.qty, 4)).toLocaleString("en-US")} @ {Number(decToString(m.unitCostVnd, 2)).toLocaleString("en-US")} ₫
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {signatures.length > 0 ? (
        <div className="card p-4">
          <h3 className="label">{t("signatures")}</h3>
          <ul className="space-y-1.5">
            {signatures.map((s) => (
              <li key={s.id} className="rounded-lg border border-line bg-white px-3 py-2 text-xs">
                <span className="font-semibold text-navy">{s.fullNamePrinted}</span>
                <span className="mx-1.5 rounded bg-navy/10 px-1.5 py-0.5 font-bold text-navy">{s.meaning}</span>
                <span className="text-grey">{formatVnDateTime(s.signedAt)}</span>
                {/* eslint-disable-next-line @next/next/no-img-element -- data-URI signature; next/image cannot optimize a data URI */}
                {s.imageData ? <img src={s.imageData} alt="" className="mt-1 block h-9 max-w-[170px] object-contain" /> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-grey">{label}</dt>
      <dd className="mt-0.5 text-body">{value}</dd>
    </div>
  );
}
