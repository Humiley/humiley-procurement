"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { safeCallback } from "@/lib/safe-callback";

export type LoginState = { error?: "invalid" | "locked" } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  // Re-validated HERE and not merely on the page that rendered it: the callback travels through a
  // hidden form field, so by the time it arrives it is ordinary user input again. Validating only
  // where it is displayed protects nobody.
  const to =
    safeCallback(formData.get("callbackUrl"), process.env.NEXT_PUBLIC_BASE_PATH || "") ??
    "/dashboard";
  try {
    await signIn("credentials", { email, password, redirectTo: to });
    return null;
  } catch (error) {
    if (error instanceof AuthError) {
      // authorize() returns null for both bad-credentials and lockout; surface generic.
      return { error: "invalid" };
    }
    // NEXT_REDIRECT (successful sign-in) must propagate.
    throw error;
  }
}
