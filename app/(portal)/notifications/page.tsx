import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatVnDateTime } from "@/lib/dates";
import { MarkAllButton, MarkReadButton } from "@/components/shell/NotificationButtons";

/** In-app notification inbox (§6) — bilingual rows written by lib/notify. */
export default async function NotificationsPage() {
  const user = await requireUser();
  const locale = await getLocale();
  const t = await getTranslations("notifications");
  const items = await db.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Bell className="h-5 w-5 text-navy" />
        <h1 className="page-title">{t("title")}</h1>
        {unread > 0 ? (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">{unread}</span>
        ) : null}
        {unread > 0 ? <MarkAllButton label={t("markAll")} /> : null}
      </div>

      {items.length === 0 ? (
        <p className="card p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const title = locale === "vi" ? n.titleVn : n.titleEn;
            const body = locale === "vi" ? n.bodyVn : n.bodyEn;
            return (
              <li key={n.id}>
                <div className={`flex items-start gap-3 rounded-xl border p-3 ${n.isRead ? "border-line bg-white" : "border-navy/30 bg-navy/5"}`}>
                  {/* opening a notification marks it read via /notifications/go/[id] */}
                  <Link href={`/notifications/go/${n.id}`} className="min-w-0 flex-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-navy/50">
                    <p className={`text-sm ${n.isRead ? "font-medium text-ink" : "font-bold text-navy"}`}>{title}</p>
                    {body ? <p className="mt-0.5 truncate text-xs text-grey">{body}</p> : null}
                  </Link>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-grey">{formatVnDateTime(n.createdAt)}</span>
                    {!n.isRead ? <MarkReadButton id={n.id} label={t("markRead")} /> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
