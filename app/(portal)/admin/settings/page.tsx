import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireRoles } from "@/lib/rbac";
import { db } from "@/lib/db";
import { ScrollText, AlertTriangle } from "lucide-react";
import { ymdHmVn } from "@/lib/dates";
import { IntegrityPanel } from "@/components/admin/IntegrityPanel";
import { IntegrationPanels, type ApiKeyRow, type WebhookRow } from "@/components/admin/IntegrationPanels";
import { FileSpreadsheet } from "lucide-react";

/** §15/§19 admin console — chain integrity, audit trail, exception register shortcuts. */
export default async function SettingsPage() {
  await requireRoles("ADMIN");
  const t = await getTranslations("adminSettings");

  const [auditCount, exceptionCount, sigCount, apiKeys, webhooks] = await Promise.all([
    db.auditLog.count(),
    db.exception.count(),
    db.electronicSignature.count(),
    db.apiKey.findMany({ orderBy: { createdAt: "desc" } }),
    db.webhookSubscription.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  const keyRows: ApiKeyRow[] = apiKeys.map((k) => ({
    id: k.id, name: k.name, prefix: k.prefix, isActive: k.isActive,
    lastUsedAt: k.lastUsedAt ? ymdHmVn(k.lastUsedAt) : null,
  }));
  const hookRows: WebhookRow[] = webhooks.map((w) => ({ id: w.id, url: w.url, events: w.events, hasSecret: !!w.secret }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
        <p className="mt-0.5 text-sm text-grey">{t("subtitle")}</p>
      </div>

      <IntegrityPanel />

      <IntegrationPanels keys={keyRows} hooks={hookRows} />

      <Link href="/admin/accounting-export" className="card flex items-center gap-3 p-4 transition hover:shadow-md">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald/10 text-emerald"><FileSpreadsheet className="h-5 w-5" /></span>
        <span>
          <span className="block text-sm font-semibold text-navy">{t("exportTitle")}</span>
          <span className="block text-xs text-grey">{t("exportDesc")}</span>
        </span>
      </Link>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Link href="/admin/audit" className="card flex items-center gap-3 p-4 transition hover:shadow-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy/10 text-navy"><ScrollText className="h-5 w-5" /></span>
          <span>
            <span className="block text-sm font-semibold text-navy">{t("auditTitle")}</span>
            <span className="block text-xs text-grey">{t("auditDesc", { count: auditCount })}</span>
          </span>
        </Link>
        <Link href="/reports/exception-register" className="card flex items-center gap-3 p-4 transition hover:shadow-md">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/15 text-warning"><AlertTriangle className="h-5 w-5" /></span>
          <span>
            <span className="block text-sm font-semibold text-navy">{t("exceptionTitle")}</span>
            <span className="block text-xs text-grey">{t("exceptionDesc", { count: exceptionCount })}</span>
          </span>
        </Link>
      </div>

      <p className="text-xs text-grey">{t("sigCount", { count: sigCount })}</p>
    </div>
  );
}
