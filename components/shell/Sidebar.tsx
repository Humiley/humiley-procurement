"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { X, LogOut } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/shared/Logo";
import { signOutAction } from "@/app/actions/session";
import { NAV, canSeeNav } from "./nav";

/**
 * Single active nav item: the longest nav href that matches the pathname (exact or
 * segment-prefix). Prevents /inventory/issues from lighting both "Inventory" and
 * "Goods Issues".
 */
function activeHref(pathname: string): string | null {
  let best: string | null = null;
  for (const group of NAV) {
    for (const it of group.items) {
      if (pathname === it.href || pathname.startsWith(it.href + "/")) {
        if (!best || it.href.length > best.length) best = it.href;
      }
    }
  }
  return best;
}

export function Sidebar({
  user,
  open,
  onClose,
}: {
  user: { name: string; roles: Role[] };
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations("nav");
  const tc = useTranslations("common");
  const troles = useTranslations("roles");
  const ta = useTranslations("auth");
  const asideRef = useRef<HTMLElement>(null);
  const current = activeHref(pathname);
  const roles = user.roles;

  const initials =
    user.name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";

  // Off-canvas drawer: when closed on mobile its links must not be tabbable. On lg the
  // sidebar is static, so inert only applies below the lg breakpoint.
  useEffect(() => {
    const el = asideRef.current;
    if (!el) return;
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => {
      el.inert = !open && !mq.matches;
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [open]);

  // While the drawer is open: Escape closes it and body scroll is locked.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <>
      {/* mobile scrim */}
      <button
        type="button"
        aria-label={tc("close")}
        aria-hidden={!open}
        tabIndex={open ? 0 : -1}
        className={cn(
          "fixed inset-0 z-30 bg-navyDeep/50 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      {/* Floating navy panel on desktop (portal "Crextio" look); full-height drawer on mobile. */}
      <aside
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-sidebar text-white transition-transform",
          "lg:sticky lg:top-3.5 lg:m-3.5 lg:h-[calc(100vh-28px)] lg:w-[236px] lg:translate-x-0 lg:rounded-[26px] lg:shadow-sidebar",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" onClick={onClose}>
            <Logo variant="white" />
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label={tc("close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto pb-3">
          {NAV.map((group, gi) => {
            const items = group.items.filter((it) => canSeeNav(it, roles));
            if (items.length === 0) return null;
            return (
              <div key={gi} className="mb-0.5">
                {group.titleKey && (
                  <p className="px-5 pb-[5px] pt-3.5 text-[9px] font-medium uppercase tracking-[1.5px] text-white/40">
                    {t(group.titleKey)}
                  </p>
                )}
                <ul>
                  {items.map((it) => {
                    const active = it.href === current;
                    const Icon = it.icon;
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "relative mx-2.5 flex items-center gap-[11px] rounded-xl px-[13px] py-[9px] text-[13.5px] transition",
                            active
                              ? "bg-white/[0.16] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)] before:absolute before:left-[-10px] before:top-1/2 before:h-5 before:w-1 before:-translate-y-1/2 before:rounded before:bg-emerald before:content-['']"
                              : "text-white/65 hover:bg-white/[0.09] hover:text-white",
                          )}
                        >
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

        {/* Footer user card — mirrors the portal's sidebar user chip + sign out. */}
        <div className="mt-auto border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-2xl px-2 py-1.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald text-[12px] font-bold text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">{user.name}</p>
              <p className="truncate text-[10px] text-white/50">
                {roles.map((r) => troles(r)).join(", ")}
              </p>
            </div>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-2xl bg-white/[0.08] py-2 text-[12px] font-semibold text-white/85 transition hover:bg-white/[0.16] hover:text-white"
            >
              <LogOut className="h-3.5 w-3.5" /> {ta("signOut")}
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
