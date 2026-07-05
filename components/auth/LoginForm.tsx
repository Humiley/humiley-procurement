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

export function LoginForm() {
  const t = useTranslations("auth");
  const [state, action] = useFormState(loginAction, null);

  return (
    <form action={action} className="space-y-4">
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
