import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { AppShell } from "@/components/shell/AppShell";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser();
  const unreadCount = await db.notification.count({
    where: { userId: user.id, isRead: false },
  });

  return (
    <AppShell
      user={{ name: user.name, email: user.email, roles: user.roles }}
      unreadCount={unreadCount}
    >
      {children}
    </AppShell>
  );
}
