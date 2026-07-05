"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";

export type LoginState = { error?: "invalid" | "locked" } | null;

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await signIn("credentials", { email, password, redirectTo: "/dashboard" });
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
