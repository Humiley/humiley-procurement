"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/shared/Logo";
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
  const tc = useTranslations("common");
  const asideRef = useRef<HTMLElement>(null);
  const current = activeHref(pathname);

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
          "fixed inset-0 z-30 bg-body/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <aside
        ref={asideRef}
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-navy text-white transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" onClick={onClose}>
            <Logo variant="white" />
          </Link>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-md text-white/70 hover:text-white lg:hidden"
            onClick={onClose}
            aria-label={tc("close")}
          >
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
                    const active = it.href === current;
                    const Icon = it.icon;
                    return (
                      <li key={it.href}>
                        <Link
                          href={it.href}
                          onClick={onClose}
                          aria-current={active ? "page" : undefined}
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
