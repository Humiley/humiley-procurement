"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { changePassword } from "@/app/change-password/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("cp");
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {t("submit")}
    </button>
  );
}

export function ChangePasswordForm({ forced }: { forced: boolean }) {
  const t = useTranslations("cp");
  const [state, action] = useFormState(changePassword, null);

  return (
    <form action={action} className="space-y-4">
      {!forced && (
        <div>
          <label className="label" htmlFor="current">{t("current")}</label>
          <input id="current" name="current" type="password" autoComplete="current-password" required className="field" />
        </div>
      )}
      <div>
        <label className="label" htmlFor="next">{t("new")}</label>
        <input id="next" name="next" type="password" autoComplete="new-password" required className="field" />
        <p className="mt-1 text-xs text-grey">{t("rule")}</p>
      </div>
      <div>
        <label className="label" htmlFor="confirm">{t("confirm")}</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="field" />
      </div>
      {state?.error ? (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {t(state.error.replace("cp.", "") as never)}
        </p>
      ) : null}
      <SubmitButton />
    </form>
  );
}
