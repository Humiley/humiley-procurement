"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { act } from "@/lib/act";
import { useActionError } from "@/lib/use-action-error";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(portal)/approvals/actions";

/** Mark-read controls with a visible pending state — rendered OUTSIDE the row link. */
export function MarkReadButton({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const fmtErr = useActionError();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              act(await markNotificationRead(id));
              router.refresh();
            } catch (e) {
              setError(fmtErr(e));
            }
          })
        }
        className="rounded border border-line px-2 py-0.5 text-[11px] text-grey transition hover:bg-grey/10 disabled:opacity-50"
      >
        {pending ? <Loader2 className="inline h-3 w-3 animate-spin" /> : label}
      </button>
      {error ? <span role="alert" className="text-[11px] text-danger">{error}</span> : null}
    </span>
  );
}

export function MarkAllButton({ label }: { label: string }) {
  const router = useRouter();
  const fmtErr = useActionError();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="ml-auto inline-flex items-center gap-2">
      {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            try {
              act(await markAllNotificationsRead());
              router.refresh();
            } catch (e) {
              setError(fmtErr(e));
            }
          })
        }
        className="rounded-lg border border-line px-3 py-1 text-xs font-semibold text-grey transition hover:bg-grey/10 disabled:opacity-50"
      >
        {pending ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : label}
      </button>
    </span>
  );
}
