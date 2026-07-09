"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

/** Client shell coordinating the mobile drawer; server layout supplies user + unread count. */
export function AppShell({
  user,
  unreadCount,
  children,
}: {
  user: { name: string; email: string; roles: Role[] };
  unreadCount: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const tc = useTranslations("common");
  return (
    <div className="flex min-h-screen bg-panel">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-navy focus:shadow-card"
      >
        {tc("skipToContent")}
      </a>
      <Sidebar roles={user.roles} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} unreadCount={unreadCount} onMenu={() => setOpen(true)} />
        <main id="main" tabIndex={-1} className="flex-1 p-4 outline-none sm:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
