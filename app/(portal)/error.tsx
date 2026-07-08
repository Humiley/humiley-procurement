"use client";

/** Branded in-app error boundary — bilingual static text (provider may be unavailable). */
export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <p className="text-4xl font-black text-danger">⚠</p>
      <h1 className="text-lg font-bold text-navy">Something went wrong · Đã xảy ra lỗi</h1>
      <p className="max-w-md text-sm text-grey">
        {error.message || "Unexpected error."}
        {error.digest ? <span className="block font-mono text-xs">ref {error.digest}</span> : null}
      </p>
      <button type="button" onClick={reset} className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white hover:opacity-90">
        Try again · Thử lại
      </button>
    </div>
  );
}
