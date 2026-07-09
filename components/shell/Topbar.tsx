"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [q, setQ] = useState("");

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const code = q.trim();
    if (!code) return;
    router.push(`/scan?code=${encodeURIComponent(code)}`);
  }

  return (
    <header className="sticky top-0 z-20 flex h-[52px] items-center gap-2 border-b border-line bg-white px-4 shadow-topbar sm:gap-3 sm:px-6">
      <button
        type="button"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-grey transition hover:bg-panel hover:text-body lg:hidden"
        onClick={onMenu}
        aria-label={t("nav.menu")}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Document-number search: submits to the scan hub, which resolves any code. */}
      <form role="search" className="relative hidden max-w-md flex-1 sm:block" onSubmit={submitSearch}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-grey" />
        <input
          className="field pl-9"
          placeholder={t("common.search")}
          aria-label={t("shell.searchHint")}
          title={t("shell.searchHint")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          enterKeyHint="search"
        />
      </form>
      {/* Below sm the input is hidden; keep search reachable via the scan hub. */}
      <Link
        href="/scan"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-grey transition hover:bg-panel hover:text-body sm:hidden"
        aria-label={t("shell.searchHint")}
      >
        <Search className="h-5 w-5" />
      </Link>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <LocaleSwitcher />
        <Link
          href="/notifications"
          className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-grey transition hover:bg-panel hover:text-body"
          aria-label={t("nav.notifications")}
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald px-1 text-[10px] font-bold text-white">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
        <UserMenu name={user.name} email={user.email} roles={user.roles} />
      </div>
    </header>
  );
}
