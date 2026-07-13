"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BASE_PATH } from "@/lib/base-path";

/**
 * Bridges navigation with the Humiley Portal when this app is embedded as the portal's native
 * "Procurement" section (an <iframe>). The portal's OWN sidebar drives navigation:
 *  • the portal postMessages { humileyNav: "/requisitions" } → we router.push() it (no reload);
 *  • we post { humileyEmbed: "route", path } back on every route change so the portal can
 *    highlight the matching sidebar item;
 *  • we post { humileyEmbed: "ready" } once on mount so the portal can send the first destination.
 * Renders nothing. No-op when not framed.
 */
export function EmbedBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      framed = true; // cross-origin access threw → we are framed
    }
    if (!framed) return;

    // In production the portal frames us same-origin, so ONLY same-origin is trusted; the
    // localhost/127.0.0.1 allowance is dev-only (portal :8000 framing procurement :3000).
    const devOrigins = process.env.NODE_ENV !== "production";
    const trusted = (origin: string) =>
      origin === window.location.origin ||
      (devOrigins &&
        (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)));

    function onMessage(e: MessageEvent) {
      if (!trusted(e.origin)) return;
      const d = e.data as { humileyNav?: unknown };
      if (!d || typeof d !== "object" || typeof d.humileyNav !== "string") return;
      const raw = d.humileyNav;
      // Must be an app-relative path — reject protocol-relative ("//evil") / backslash tricks that
      // would let router.push() hard-navigate the frame off-site.
      if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) return;
      // Accept either an app-relative ("/requisitions") or basePath-prefixed path; router.push()
      // wants app-relative (it re-adds the basePath itself).
      const p = BASE_PATH && raw.startsWith(BASE_PATH) ? raw.slice(BASE_PATH.length) || "/" : raw;
      router.push(p);
    }

    window.addEventListener("message", onMessage);
    try {
      window.parent.postMessage({ humileyEmbed: "ready" }, "*");
    } catch {
      /* parent unreachable */
    }
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

  useEffect(() => {
    let framed = false;
    try {
      framed = window.self !== window.top;
    } catch {
      framed = true;
    }
    if (!framed) return;
    try {
      window.parent.postMessage({ humileyEmbed: "route", path: pathname }, "*");
    } catch {
      /* parent unreachable */
    }
  }, [pathname]);

  return null;
}
