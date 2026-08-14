/**
 * A per-process secret shared between the boot timer and the sweep route. Held on globalThis so
 * both module graphs (instrumentation's and the route's) see the SAME value inside one server
 * process, and so a dev hot-reload does not mint a second one and lock the timer out.
 *
 * Uses the Web Crypto global rather than `node:crypto`: this module is reachable from
 * instrumentation.ts, which is compiled for the EDGE runtime too, and a `node:` import there is
 * an unhandled scheme that fails the whole build.
 */
const KEY = Symbol.for("humiley.sweepToken");

export function sweepToken(): string {
  const g = globalThis as unknown as Record<symbol, string>;
  if (!g[KEY]) g[KEY] = globalThis.crypto.randomUUID();
  return g[KEY];
}
