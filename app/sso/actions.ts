"use server";

import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";

/**
 * Complete the portal SSO handoff: exchange the signed token for a session, then land on the
 * dashboard. On any failure fall back to the normal login screen (never a dead end).
 */
export async function completeSso(token: string): Promise<void> {
  try {
    await signIn("portal-sso", { token, redirectTo: "/dashboard" });
  } catch (e) {
    // Auth.js signals a successful sign-in with a NEXT_REDIRECT throw — let it propagate.
    if (e && typeof e === "object" && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT")) {
      throw e;
    }
    redirect("/login?sso=failed");
  }
}
