import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SsoAutoSubmit } from "@/components/auth/SsoAutoSubmit";

/**
 * Portal SSO landing. The portal launcher opens /sso?t=<signed token>; this exchanges it for a
 * procurement session and forwards to the dashboard — no login screen for a portal user.
 */
export default async function SsoPage({ searchParams }: { searchParams: { t?: string | string[] } }) {
  const session = await auth();
  if (session?.user) redirect("/dashboard"); // already signed in

  const raw = Array.isArray(searchParams.t) ? searchParams.t[0] : searchParams.t;
  const token = (raw ?? "").trim();
  if (!token) redirect("/login");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-panel">
      <p className="text-sm text-grey">Signing you in…</p>
      <SsoAutoSubmit token={token} />
    </div>
  );
}
