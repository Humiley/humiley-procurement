/**
 * Route-transition skeleton for every portal segment. Without a loading boundary the
 * App Router freezes the old page (zero feedback) while the next page's Prisma
 * queries run — on heavy pages (dashboard, reports) the app looked dead.
 * Pure decoration: no strings, so no i18n surface.
 */
export default function PortalLoading() {
  return (
    <div className="animate-pulse space-y-6" aria-hidden="true">
      <div className="space-y-2">
        <div className="h-7 w-56 rounded-md bg-navy/10" />
        <div className="h-4 w-80 rounded bg-black/5" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card flex items-center gap-4 p-4">
            <div className="h-11 w-11 shrink-0 rounded-lg bg-navy/10" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-6 w-16 rounded bg-black/10" />
              <div className="h-3 w-24 rounded bg-black/5" />
            </div>
          </div>
        ))}
      </div>
      <div className="card overflow-hidden">
        <div className="h-10 bg-navy/90" />
        <div className="divide-y divide-black/5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-32 rounded bg-black/10" />
              <div className="h-4 flex-1 rounded bg-black/5" />
              <div className="h-5 w-20 rounded-full bg-emerald/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
