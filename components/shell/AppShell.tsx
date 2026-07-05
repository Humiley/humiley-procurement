"use client";

import { useState } from "react";
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
  return (
    <div className="flex min-h-screen bg-panel">
      <Sidebar roles={user.roles} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} unreadCount={unreadCount} onMenu={() => setOpen(true)} />
        <main className="flex-1 p-4 sm:p-6">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
