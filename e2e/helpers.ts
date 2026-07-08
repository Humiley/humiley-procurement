import { Page, expect } from "@playwright/test";

export const PASSWORD = "Humiley@2026";

export async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.locator('input[type="email"], input[name="email"]').fill(email);
  await page.locator('input[type="password"]').fill(PASSWORD);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/dashboard|requisitions|approvals/, { timeout: 20_000 });
}

export async function logout(page: Page) {
  const csrf = await page.evaluate(async () => (await fetch("/api/auth/csrf").then((r) => r.json())).csrfToken);
  await page.evaluate(async (token) => {
    await fetch("/api/auth/signout", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `csrfToken=${encodeURIComponent(token)}&json=true`,
    });
  }, csrf);
}

/** Complete the §19 SignatureDialog that is currently open. */
export async function sign(page: Page, submitLabel: RegExp | string) {
  const dialog = page.locator("div.fixed.inset-0.z-50");
  await expect(dialog).toBeVisible();
  await dialog.locator('input[type="password"]').fill(PASSWORD);
  await dialog.getByRole("button", { name: submitLabel }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
