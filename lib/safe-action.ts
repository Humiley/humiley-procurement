import "server-only";
import { ZodError } from "zod";

/**
 * Server-action failure envelope. Next.js REDACTS thrown Error messages from Server
 * Actions in production builds (generic "An error occurred…" + digest), so expected
 * failures must travel as DATA, not exceptions. Every exported action wraps its
 * implementation in `guard()`; clients re-throw via lib/act.ts so existing
 * try/catch UI keeps working — with the real message, in production too.
 */
export type ActionFailure = { __err: string };

export function isActionFailure(v: unknown): v is ActionFailure {
  return typeof v === "object" && v !== null && "__err" in v && typeof (v as ActionFailure).__err === "string";
}

/** Format a ZodError as readable field messages instead of the raw JSON dump. */
function zodMessage(e: ZodError): string {
  return e.issues
    .map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message))
    .join(" · ");
}

export async function guard<A extends unknown[], R>(
  fn: (...args: A) => Promise<R>,
  args: A,
): Promise<R | ActionFailure> {
  try {
    return await fn(...args);
  } catch (e) {
    // Next.js control-flow "errors" (redirect(), notFound()) must pass through untouched.
    if (typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_")) {
      throw e;
    }
    if (e instanceof ZodError) return { __err: zodMessage(e) };
    if (e instanceof Error) return { __err: e.message };
    return { __err: String(e) };
  }
}
