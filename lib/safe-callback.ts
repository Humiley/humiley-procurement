/**
 * Where a user is sent after signing in.
 *
 * The middleware records where they were heading (`?callbackUrl=/procurement/contracts/abc`) so
 * login can return them there instead of dumping everyone on the dashboard. That value arrives
 * from the URL bar, so it is ATTACKER-CONTROLLED: a phishing link like
 *
 *     /procurement/login?callbackUrl=https://evil.example/harvest
 *
 * would otherwise turn our own login page into a redirector that lands people on someone else's
 * site immediately after they typed a password. So this returns a path or it returns null, and
 * anything it is not completely sure about becomes null.
 *
 * Pure — no imports, no server-only — so it can be unit-tested directly, which is the point.
 *
 * ⚠️ THE CHECKS BELOW DELIBERATELY OVERLAP. The explicit tests (leading slash, "//", backslash,
 * "/@") and the final origin probe cover most of the same ground: the URL parser resolves "//x",
 * "/\x", "\\x" and "https://x" to a foreign origin all by itself, so either layer alone would
 * reject them. Mutation testing shows this — delete any ONE of them and no test fails. That is the
 * intended property for a security boundary, not dead code: one mechanism failing (a parser quirk,
 * a runtime difference) must not open the door. The one check with no partner is "/@", which the
 * parser reads as an ordinary path. Do not remove any of them because "the tests still pass".
 */

/** Longer than any real route here; a giant callback is either a mistake or an attack. */
const MAX = 512;

export function safeCallback(raw: unknown, basePath: string): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > MAX) return null;

  // Browsers treat a backslash as a slash when resolving URLs, so "/\evil.example" and
  // "\\evil.example" navigate OFF-SITE. Normalise first, then judge what it really is.
  let url = raw.replace(/\\/g, "/");

  // Control characters (CR, LF, NUL, tab) can split a Location header or slip past a naive check.
  // Their presence is never legitimate here, so reject rather than strip — stripping would let a
  // crafted value through in a shape we did not intend to allow.
  if (/[\u0000-\u001f\u007f]/.test(url)) return null;

  // Must be a site-relative path. This alone rejects "https://evil.example", "javascript:…",
  // "data:…" and every other scheme, because none of them start with a slash.
  if (!url.startsWith("/")) return null;

  // "//evil.example" is PROTOCOL-RELATIVE: it starts with a slash but goes to another host.
  if (url.startsWith("//")) return null;

  // No credentials/host smuggling via "/@evil.example" style targets either.
  if (url.startsWith("/@")) return null;

  // Normalise to app-relative, accepting the path WITH or WITHOUT the basePath. Next reports the
  // basePath inconsistently between the edge middleware and a server component — production emitted
  // "/procurement/contracts" while dev emitted "/contracts" for the same navigation — so demanding
  // one shape silently threw away legitimate destinations and dumped people on the dashboard. What
  // actually matters for safety is that it resolves to OUR ORIGIN, which every check above and the
  // probe below enforce; the prefix is a routing detail, so normalise it rather than judge it.
  const bp = basePath || "";
  const rest = bp && (url === bp || url.startsWith(bp + "/")) ? url.slice(bp.length) || "/" : url;
  if (rest === "/login" || rest.startsWith("/login?") || rest.startsWith("/login/")) return null;

  // Last check on the resolved form: if it parses as absolute against a dummy origin and comes out
  // pointing anywhere other than that origin, it was not the relative path it appeared to be.
  try {
    const probe = new URL(bp + rest, "https://callback.invalid");
    if (probe.origin !== "https://callback.invalid") return null;

    // Judge the OUTPUT, not just the input. Path normalisation can manufacture a hostile value out
    // of an innocent-looking one: "/..//evil.example" resolves against our own origin — the probe
    // above is happy — but its PATHNAME is "//evil.example", which is protocol-relative and sends
    // the browser to another host the moment it is used. Checking only what came in missed this.
    const out = probe.pathname + probe.search + probe.hash;
    if (!out.startsWith("/") || out.startsWith("//") || out.startsWith("/@")) return null;
    if (bp && out !== bp && !out.startsWith(bp + "/")) return null;
    return out;
  } catch {
    return null;
  }
}
