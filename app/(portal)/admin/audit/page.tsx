import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatVnDateTime } from "@/lib/dates";

/** §16 immutable audit trail viewer — entity/action/user filters, newest first. ADMIN. */
export default async function AuditPage({ searchParams }: { searchParams: { entityType?: string; action?: string; user?: string } }) {
  await requireRoles("ADMIN");
  const t = await getTranslations("auditlog");

  const where = {
    ...(searchParams.entityType ? { entityType: searchParams.entityType } : {}),
    ...(searchParams.action ? { action: { contains: searchParams.action.toUpperCase() } } : {}),
    ...(searchParams.user ? { user: { OR: [{ name: { contains: searchParams.user, mode: "insensitive" as const } }, { email: { contains: searchParams.user, mode: "insensitive" as const } }] } } : {}),
  };
  const [rows, entityTypes] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 100, include: { user: { select: { name: true } } } }),
    db.auditLog.findMany({ distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/settings" className="text-sm text-grey hover:text-navy">← {t("back")}</Link>
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
      </div>

      <form className="flex flex-wrap items-end gap-2 rounded-xl border border-grey/20 bg-white p-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("entityType")}</span>
          <select name="entityType" defaultValue={searchParams.entityType ?? ""} className="field">
            <option value="">{t("all")}</option>
            {entityTypes.map((e) => (
              <option key={e.entityType} value={e.entityType}>{e.entityType}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("action")}</span>
          <input name="action" defaultValue={searchParams.action ?? ""} className="field" placeholder="PR_SUBMIT…" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-grey">{t("user")}</span>
          <input name="user" defaultValue={searchParams.user ?? ""} className="field" />
        </label>
        <button type="submit" className="btn-outline">{t("apply")}</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-grey/20 bg-white">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-grey/20 text-left text-xs uppercase tracking-wide text-grey">
              <th className="px-3 py-2.5">{t("when")}</th>
              <th className="px-3 py-2.5">{t("user")}</th>
              <th className="px-3 py-2.5">{t("action")}</th>
              <th className="px-3 py-2.5">{t("entity")}</th>
              <th className="px-3 py-2.5">{t("detail")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-grey">{t("empty")}</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-grey/10 last:border-0">
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatVnDateTime(r.createdAt)}</td>
                  <td className="px-3 py-2">{r.user?.name ?? "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs font-bold text-navy">{r.action}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.entityType}<span className="text-grey"> · {r.entityId.slice(-8)}</span></td>
                  <td className="max-w-[320px] truncate px-3 py-2 font-mono text-[11px] text-grey">{r.afterJson ? JSON.stringify(r.afterJson).slice(0, 120) : "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-grey">{t("cap")}</p>
    </div>
  );
}
