/**
 * The app's basePath (see next.config.mjs). Next auto-prefixes <Link>, redirect(), useRouter(),
 * and next/image — but NOT raw fetch() strings or manually built URLs, so those must use withBase().
 * NEXT_PUBLIC_BASE_PATH is injected at build time from the same basePath value.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Prefix a root-relative path with the app basePath (e.g. "/api/x" → "/procurement/api/x"). */
export function withBase(path: string): string {
  if (!path.startsWith("/")) return path;
  return BASE_PATH + path;
}
