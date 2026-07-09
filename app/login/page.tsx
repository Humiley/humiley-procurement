import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { Logo } from "@/components/shared/Logo";
import { LoginForm } from "@/components/auth/LoginForm";

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
    <div className="flex min-h-screen items-center justify-center bg-panel p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo variant="navy" />
        </div>
        <div className="card p-6">
          <h1 className="text-lg font-bold text-navy">{t("welcome")}</h1>
          <p className="mb-5 mt-0.5 text-sm text-grey">{t("subtitle")}</p>
          <LoginForm prefillEmail={prefillEmail} />
        </div>
        <p className="mt-4 text-center text-xs text-grey">
          Humiley Procurement Portal
        </p>
      </div>
    </div>
  );
}
