"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { loginAction } from "@/app/login/actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const t = useTranslations("auth");
  return (
    <button type="submit" className="btn-primary w-full" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" />}
      {pending ? t("signingIn") : t("signIn")}
    </button>
  );
}

export function LoginForm({
  prefillEmail = "",
  callbackUrl = null,
}: {
  prefillEmail?: string;
  /** Already validated on the server; carried so sign-in can return the user where they were
   *  headed. Re-checked in loginAction, because a hidden field is user input. */
  callbackUrl?: string | null;
}) {
  const t = useTranslations("auth");
  const [state, action] = useFormState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <div>
        <label className="label" htmlFor="email">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          defaultValue={prefillEmail}
          className="field"
        />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          autoFocus={!!prefillEmail}
          className="field"
        />
      </div>
      {state?.error && (
        <p className="rounded-md bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
          {t(state.error)}
        </p>
      )}
      <SubmitButton />
    </form>
  );
}
