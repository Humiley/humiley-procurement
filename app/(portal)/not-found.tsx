import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * In-shell 404 for portal routes: a bad or inaccessible document id keeps the
 * sidebar/topbar (the root not-found dropped the whole shell, stranding the user).
 */
export default async function PortalNotFound() {
  const t = await getTranslations("notFound");
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
      <p className="text-5xl font-black tracking-tight text-navy">404</p>
      <h1 className="text-lg font-bold text-navy">{t("title")}</h1>
      <p className="max-w-md text-sm text-grey">{t("body")}</p>
      <Link href="/dashboard" className="btn-navy mt-2">
        {t("home")}
      </Link>
    </div>
  );
}
