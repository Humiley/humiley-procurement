/**
 * Client-side unwrapper for guarded server actions (see lib/safe-action.ts).
 * Expected failures arrive as `{ __err }` data; `act()` re-throws them as a local
 * Error so the existing try/catch + useActionError UI works unchanged — and the
 * real message survives production builds.
 */
export function act<T>(result: T | { __err: string }): T {
  if (typeof result === "object" && result !== null && "__err" in result) {
    throw new Error((result as { __err: string }).__err);
  }
  return result as T;
}
