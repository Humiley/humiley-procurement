/**
 * Optimistic-guarded status transitions (spec §22.2 — the ONLY way any document changes status).
 *
 * The guard is a single conditional UPDATE: `WHERE id = ? AND status IN (from…)`. If another
 * session changed the row between our read and our write, `count` comes back 0 and the caller
 * surfaces a friendly "someone else got there first" error instead of double-transitioning.
 */

type StatusDelegate = {
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
};

export async function transition(
  delegate: StatusDelegate,
  id: string,
  from: string | string[],
  to: string,
  opts: {
    /** Extra fields to set together with the status (e.g. approvedAt). */
    data?: Record<string, unknown>;
    /** Extra conditions that must still hold for the transition to win (e.g. currentApprovalLevel: 0). */
    where?: Record<string, unknown>;
  } = {},
): Promise<boolean> {
  const res = await delegate.updateMany({
    where: {
      id,
      status: Array.isArray(from) ? { in: from } : from,
      ...(opts.where ?? {}),
    },
    data: { status: to, ...(opts.data ?? {}) },
  });
  return res.count === 1;
}

/** Standard error for a lost optimistic race — the document moved on while the user looked at it. */
export function staleError(): Error {
  return new Error("This document was just updated by someone else — refresh and try again.");
}
