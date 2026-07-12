"use client";

import { useEffect, useState } from "react";
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
  // Mark the root when the portal frames us (in-portal Procurement section) so the embed CSS in
  // globals.css hides our own top bar. A pre-paint script in app/layout.tsx does this too; this
  // runs after hydration to guarantee the attribute survives React's reconciliation of <html>.
  useEffect(() => {
    try {
      if (window.self !== window.top) document.documentElement.setAttribute("data-embed", "1");
    } catch {
      document.documentElement.setAttribute("data-embed", "1"); // cross-origin access threw → we're framed
    }
  }, []);
  return (
    <div className="flex min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[60] focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-navy focus:shadow-card"
      >
        {tc("skipToContent")}
      </a>
      <Sidebar user={user} open={open} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar user={user} unreadCount={unreadCount} onMenu={() => setOpen(true)} />
        {/* Content fills the width like the portal (no centered max-w cap that left a huge empty
            right side on wide screens); a high ceiling only reins in ultra-wide monitors. */}
        <main id="main" tabIndex={-1} className="w-full flex-1 px-4 pb-[30px] pt-2 outline-none sm:px-7">
          <div className="mx-auto w-full max-w-[1760px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
