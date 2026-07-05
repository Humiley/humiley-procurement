"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/shared/Logo";
import { NAV, canSeeNav } from "./nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export function Sidebar({
  roles,
  open,
  onClose,
}: {
  roles: Role[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <>
      {/* mobile scrim */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-body/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" onClick={onClose}>
            <Logo variant="white" />
          </Link>
          <button className="text-white/70 hover:text-white lg:hidden" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto px-3 pb-6 pt-2">
          {NAV.map((group, gi) => {
            const items = group.items.filter((it) => canSeeNav(it, roles));
            if (items.length === 0) return null;
            return (
              <div key={gi}>
                {group.titleKey && (
                  <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-white/40">
                    {t(group.titleKey)}
                  </p>
                )}
                <ul className="space-y-0.5">
                  {items.map((it) => {
                    const active = isActive(pathname, it.href);
                    const Icon = it.icon;
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          onClick={onClose}
                          className={cn(
                            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                            active
                              ? "bg-white/10 text-white"
                              : "text-white/75 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-5 w-1 shrink-0 rounded-full",
                              active ? "bg-emerald" : "bg-transparent",
                            )}
                          />
                          <Icon className="h-[18px] w-[18px] shrink-0" />
                          <span className="truncate">{t(it.labelKey)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
