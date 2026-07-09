"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, LogOut } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/cn";
import { signOutAction } from "@/app/actions/session";

export function UserMenu({
  name,
  email,
  roles,
}: {
  name: string;
  email: string;
  roles: Role[];
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Move focus into the menu when it opens so items are keyboard-reachable.
  useEffect(() => {
    if (open) menuRef.current?.querySelector<HTMLElement>("button, a")?.focus();
  }, [open]);

  const initials = name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex items-center gap-2 rounded-md px-1.5 py-1 transition hover:bg-panel"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-xs font-bold text-white">
          {initials || "?"}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-sm font-medium leading-tight text-body">{name}</span>
          <span className="block text-xs leading-tight text-grey">
            {roles.map((r) => t(`roles.${r}`)).join(", ")}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-grey" />
      </button>

      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 z-50 mt-2 w-56 rounded-card border border-black/5 bg-white p-1 shadow-card"
        >
          <div className="border-b border-black/5 px-3 py-2">
            <p className="text-sm font-medium text-body">{name}</p>
            <p className="truncate text-xs text-grey">{email}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-body transition hover:bg-panel",
              )}
            >
              <LogOut className="h-4 w-4 text-grey" /> {t("auth.signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
