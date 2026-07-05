"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, Search, Bell } from "lucide-react";
import type { Role } from "@prisma/client";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { UserMenu } from "./UserMenu";

export function Topbar({
  user,
  unreadCount,
  onMenu,
}: {
  user: { name: string; email: string; roles: Role[] };
  unreadCount: number;
  onMenu: () => void;
}) {
  const t = useTranslations();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-black/5 bg-white px-4">
      <button className="text-grey hover:text-body lg:hidden" onClick={onMenu} aria-label="Menu">
        <Menu className="h-5 w-5" />
      </button>

      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey" />
        <input className="field pl-9" placeholder={t("common.search")} />
      </div>

      <div className="ml-auto flex items-center gap-3">
        <LocaleSwitcher />
        <Link
          href="/notifications"
          className="relative rounded-md p-2 text-grey transition hover:bg-panel hover:text-body"
          aria-label={t("nav.notifications")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
        <UserMenu name={user.name} email={user.email} roles={user.roles} />
      </div>
    </header>
  );
}
