"use client";

import { useEffect } from "react";
import { withBase } from "@/lib/base-path";

/**
 * The Humiley Portal login backdrop, replicated exactly: the SAME photos
 * (public/brand/login/, copied from the portal's static/brand/login/),
 * alternating by DAY OF MONTH (odd = image A, even = image B) and picking the
 * orientation-appropriate crop (portrait phones get 9:16, landscape 16:9).
 * Re-evaluates on rotate/resize, like the portal's inline _setLoginBg().
 */
export function LoginBackdrop() {
  useEffect(() => {
    const set = () => {
      const el = document.getElementById("login-overlay");
      if (!el) return;
      const img = new Date().getDate() % 2 === 1 ? "a" : "b";
      const orient = window.innerHeight > window.innerWidth ? "mobile" : "desktop";
      // withBase(): raw CSS url() is not basePath-prefixed by Next, so add /procurement (else 404).
      el.style.backgroundImage = `url('${withBase(`/brand/login/login-${img}-${orient}.jpg`)}')`;
    };
    set();
    window.addEventListener("resize", set);
    window.addEventListener("orientationchange", set);
    return () => {
      window.removeEventListener("resize", set);
      window.removeEventListener("orientationchange", set);
    };
  }, []);
  return null;
}
