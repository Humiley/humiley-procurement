/**
 * Loading skeleton shaped like a DOCUMENT DETAIL page (header + info grid + line items + timeline),
 * so opening a PO/PR/Invoice detail — which runs a heavy multi-query load — no longer flashes the
 * list-shaped portal skeleton (4 KPI cards + table) that looks like a different page.
 * Pure decoration: no strings, so no i18n surface.
 */
export function DocDetailSkeleton() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      {/* header: title + status + actions */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded-md bg-navy/10" />
          <div className="h-4 w-40 rounded bg-tint" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 rounded-lg bg-line" />
          <div className="h-9 w-28 rounded-lg bg-navy/10" />
        </div>
      </div>
      {/* two-column info grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="card space-y-3 p-5 lg:col-span-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between gap-4">
              <div className="h-4 w-28 rounded bg-tint" />
              <div className="h-4 w-40 rounded bg-line" />
            </div>
          ))}
        </div>
        {/* timeline / side panel */}
        <div className="card space-y-4 p-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-8 w-8 shrink-0 rounded-full bg-navy/10" />
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="h-3.5 w-28 rounded bg-line" />
                <div className="h-3 w-20 rounded bg-tint" />
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* line items table */}
      <div className="card overflow-hidden">
        <div className="h-10 border-b-2 border-line bg-panel" />
        <div className="divide-y divide-line">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-40 rounded bg-line" />
              <div className="h-4 flex-1 rounded bg-tint" />
              <div className="h-4 w-24 rounded bg-line" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
