"use client";

import { useEffect, useRef } from "react";
import { completeSso } from "@/app/sso/actions";

/** Fires the SSO token exchange once on mount, then the server action redirects. */
export function SsoAutoSubmit({ token }: { token: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void completeSso(token);
  }, [token]);
  return null;
}
