"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Plus, Download, ArrowUpDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type ListColumn<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  /** Raw value used for search / sort / export. Defaults to row[key]. */
  value?: (row: T) => string | number | null | undefined;
  align?: "left" | "right" | "center";
  className?: string;
  sortable?: boolean;
};

export type ListTab<T> = {
  key: string;
  label: string;
  predicate?: (row: T) => boolean;
};

/**
 * Config-driven list factory (spec §22.3 <DocListPage>): search, status tabs, sort, and
 * Export. Every register (PR/PO/GRN/INV/…) is a config, not a bespoke page. Filtering runs
 * client-side over server-provided rows; server pagination is layered per-register when a
 * register outgrows a single page (recorded in PHASE-REPORTS).
 * q/tab/sort mirror into the URL query string (router.replace, scroll:false) so list state
 * survives navigating into a row and back — still purely client-side filtering.
 */
export function DocListPage<T extends Record<string, unknown>>({
  title,
  subtitle,
  newHref,
  newLabel,
  columns,
  rows,
  rowKey,
  rowHref,
  tabs,
  searchPlaceholder,
  exportLabel,
  exportFileName,
  emptyLabel,
  toolbar,
}: {
  title: string;
  subtitle?: string;
  newHref?: string;
  newLabel?: string;
  columns: ListColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  tabs?: ListTab<T>[];
  searchPlaceholder?: string;
  exportLabel?: string;
  exportFileName?: string;
  emptyLabel?: string;
  toolbar?: React.ReactNode;
}) {
  const tl = useTranslations("list");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const defaultTab = tabs?.[0]?.key ?? "__all";

  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [tab, setTab] = useState(() => {
    const fromUrl = searchParams.get("tab");
    return fromUrl && tabs?.some((t) => t.key === fromUrl) ? fromUrl : defaultTab;
  });
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(() => {
    const raw = searchParams.get("sort");
    if (!raw) return null;
    const dir: 1 | -1 = raw.startsWith("-") ? -1 : 1;
    const key = raw.startsWith("-") ? raw.slice(1) : raw;
    return columns.some((c) => c.key === key && c.sortable) ? { key, dir } : null;
  });

  // Mirror q/tab/sort into the URL (debounced) so state survives row navigation + back.
  useEffect(() => {
    const id = setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      if (q) params.set("q", q);
      else params.delete("q");
      if (tab !== defaultTab) params.set("tab", tab);
      else params.delete("tab");
      if (sort) params.set("sort", (sort.dir === -1 ? "-" : "") + sort.key);
      else params.delete("sort");
      const next = params.toString();
      if (next !== window.location.search.replace(/^\?/, "")) {
        router.replace(next ? `${pathname}?${next}` : pathname, { scroll: false });
      }
    }, 200);
    return () => clearTimeout(id);
  }, [q, tab, sort, defaultTab, pathname, router]);

  const rawValue = (col: ListColumn<T>, row: T) =>
    col.value ? col.value(row) : (row[col.key] as string | number | null | undefined);

  const filtered = useMemo(() => {
    let r = rows;
    const activeTab = tabs?.find((t) => t.key === tab);
    if (activeTab?.predicate) r = r.filter(activeTab.predicate);
    if (q.trim()) {
      const needle = q.toLowerCase();
      r = r.filter((row) =>
        columns.some((c) => {
          const v = rawValue(c, row);
          return v != null && String(v).toLowerCase().includes(needle);
        }),
      );
    }
    if (sort) {
      const col = columns.find((c) => c.key === sort.key);
      if (col) {
        r = [...r].sort((a, b) => {
          const av = rawValue(col, a);
          const bv = rawValue(col, b);
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === "number" && typeof bv === "number") return (av - bv) * sort.dir;
          return String(av).localeCompare(String(bv)) * sort.dir;
        });
      }
    }
    return r;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, tab, sort, columns, tabs]);

  function toggleSort(key: string) {
    setSort((s) =>
      s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 },
    );
  }

  function exportCsv() {
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const head = columns.map((c) => esc(c.header)).join(",");
    const body = filtered
      .map((row) => columns.map((c) => esc(rawValue(c, row))).join(","))
      .join("\n");
    const csv = "﻿" + head + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${exportFileName ?? title.replace(/\s+/g, "-").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-grey">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-outline" onClick={exportCsv}>
            <Download className="h-4 w-4" /> {exportLabel ?? tl("exportExcel")}
          </button>
          {newHref && (
            <Link href={newHref} className="btn-primary">
              <Plus className="h-4 w-4" /> {newLabel ?? tl("new")}
            </Link>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-3">
          {tabs && tabs.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition",
                    t.key === tab
                      ? "bg-navy text-white"
                      : "text-grey hover:bg-panel hover:text-body",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          ) : (
            <div />
          )}
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {toolbar}
            <div className="relative w-56 min-w-0 max-w-full">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-grey" />
              <input
                className="field w-full pl-8"
                placeholder={searchPlaceholder ?? tl("search")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th
                    key={c.key}
                    aria-sort={
                      c.sortable
                        ? sort?.key === c.key
                          ? sort.dir === 1
                            ? "ascending"
                            : "descending"
                          : "none"
                        : undefined
                    }
                    className={cn(
                      "th",
                      c.align === "right" && "text-right",
                      c.align === "center" && "text-center",
                      c.className,
                    )}
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "flex w-full select-none items-center gap-1",
                          c.align === "right" && "justify-end",
                          c.align === "center" && "justify-center",
                        )}
                      >
                        {c.header}
                        <ArrowUpDown className="h-3 w-3 opacity-60" />
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1">{c.header}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td className="td text-center text-grey" colSpan={columns.length}>
                    {emptyLabel ?? tl("noRecords")}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const href = rowHref?.(row);
                  return (
                    <tr
                      key={rowKey(row)}
                      className={cn("group", href && "cursor-pointer hover:bg-panel")}
                    >
                      {columns.map((c, ci) => {
                        const content = c.render ? c.render(row) : (rawValue(c, row) ?? "—");
                        return (
                          <td
                            key={c.key}
                            className={cn(
                              "td",
                              c.align === "right" && "text-right",
                              c.align === "center" && "text-center",
                              c.className,
                            )}
                          >
                            {href && ci === 0 ? (
                              <Link href={href} className="block">
                                {content as React.ReactNode}
                              </Link>
                            ) : href ? (
                              <Link href={href} className="block">
                                {content as React.ReactNode}
                              </Link>
                            ) : (
                              (content as React.ReactNode)
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-line px-3 py-2 text-xs text-grey">
          {tl("countOf", { shown: filtered.length, total: rows.length })}
        </div>
      </div>
    </div>
  );
}
