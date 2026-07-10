import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Logo } from "@/components/shared/Logo";
import { ChangePasswordForm } from "@/components/auth/ChangePasswordForm";

/** Self-service password change; the middleware forces first-login users here. */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  const t = await getTranslations("cp");
  const row = await db.user.findUnique({ where: { id: user.id }, select: { mustChangePw: true } });
  const forced = row?.mustChangePw ?? false;

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-panel p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex justify-center">
          <Logo variant="navy" className="h-12" />
        </div>
        <div className="card p-6">
          <h1 className="text-lg font-bold text-navy">{forced ? t("titleForced") : t("title")}</h1>
          <p className="mb-5 mt-0.5 text-sm text-grey">{forced ? t("subForced") : t("sub")}</p>
          <ChangePasswordForm forced={forced} />
        </div>
      </div>
    </div>
  );
}
