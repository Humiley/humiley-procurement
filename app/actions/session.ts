"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { signOut } from "@/lib/auth";
import { LOCALE_COOKIE, LOCALES, type Locale } from "@/i18n/request";

/** Toggle the UI locale (spec §11 locale switcher). */
export async function setLocale(locale: Locale): Promise<void> {
  if (!(LOCALES as readonly string[]).includes(locale)) return;
  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
