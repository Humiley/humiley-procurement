import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/shared/Logo";
import { LoginForm } from "@/components/auth/LoginForm";
import { LoginBackdrop } from "@/components/auth/LoginBackdrop";

export default async function LoginPage({ searchParams }: { searchParams: { email?: string | string[] } }) {
  const session = await auth();
  if (session?.user) redirect("/dashboard");
  const t = await getTranslations("auth");
  // Humiley Portal handoff: the sidebar launcher appends ?email=<signed-in user> so the
  // procurement login opens with the account prefilled (see docs/PORTAL-INTEGRATION.md).
  // A repeated ?email= param arrives as an array — take the first value, never crash.
  const rawEmail = Array.isArray(searchParams.email) ? searchParams.email[0] : searchParams.email;
  const prefillEmail = (rawEmail ?? "").trim().slice(0, 120);

  return (
    /* Mirrors the Humiley Portal login: photo backdrop (day-alternating, orientation-aware),
       frosted-glass card, full-colour logo — one product family, one front door. */
    <div
      id="login-overlay"
      className="flex min-h-[100dvh] overflow-y-auto bg-[#0d1c39] bg-cover bg-center p-6"
    >
      <LoginBackdrop />
      <div className="login-glass relative z-[2] m-auto w-full max-w-[380px] rounded-[20px] border border-white/30 bg-white/15 px-8 pb-6 pt-7 text-center shadow-[0_24px_70px_rgba(4,16,42,0.45)] backdrop-blur-xl backdrop-saturate-125">
        <div className="mb-7 flex justify-center">
          <Logo variant="navy" className="h-[72px] sm:h-[88px]" />
        </div>
        <h1 className="login-title mb-2 text-[21px] font-extrabold tracking-tight text-navy [text-shadow:0_1px_8px_rgba(255,255,255,0.7)]">
          {t("welcome")}
        </h1>
        <p className="mb-6 text-[13px] leading-relaxed text-white/95 [text-shadow:0_1px_6px_rgba(0,0,0,0.35)]">
          {t("subtitle")}
        </p>
        <div className="text-left">
          <LoginForm prefillEmail={prefillEmail} />
        </div>
        <p className="mt-5 text-xs text-white/80 [text-shadow:0_1px_4px_rgba(0,0,0,0.3)]">
          Humiley Procurement Portal
        </p>
      </div>
    </div>
  );
}
