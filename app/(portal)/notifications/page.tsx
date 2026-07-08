import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { formatVnDateTime } from "@/lib/dates";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(portal)/approvals/actions";

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
        <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
        {unread > 0 ? (
          <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs font-bold text-danger">{unread}</span>
        ) : null}
        {unread > 0 ? (
          <form action={markAllNotificationsRead} className="ml-auto">
            <button className="rounded-lg border border-grey/30 px-3 py-1 text-xs font-semibold text-grey hover:bg-grey/10">
              {t("markAll")}
            </button>
          </form>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-grey/20 bg-white p-6 text-sm text-grey">{t("empty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const title = locale === "vi" ? n.titleVn : n.titleEn;
            const body = locale === "vi" ? n.bodyVn : n.bodyEn;
            const inner = (
              <div className={`rounded-xl border p-3 ${n.isRead ? "border-grey/15 bg-white" : "border-navy/30 bg-navy/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`text-sm ${n.isRead ? "font-medium text-ink" : "font-bold text-navy"}`}>{title}</p>
                    {body ? <p className="mt-0.5 truncate text-xs text-grey">{body}</p> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[11px] text-grey">{formatVnDateTime(n.createdAt)}</span>
                    {!n.isRead ? (
                      <form
                        action={async () => {
                          "use server";
                          await markNotificationRead(n.id);
                        }}
                      >
                        <button className="rounded border border-grey/30 px-2 py-0.5 text-[11px] text-grey hover:bg-grey/10">
                          {t("markRead")}
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </div>
            );
            return (
              <li key={n.id}>{n.link ? <Link href={n.link}>{inner}</Link> : inner}</li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
