import { Page, Locator, expect } from "@playwright/test";

export const PASSWORD = "Humiley@2026";
// prisma/seed.ts stamps document numbers with the current year — specs must follow it
export const SEED_YEAR = new Date().getFullYear();

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

/**
 * The §19 signature pad (commit 5e66bed) requires a hand-drawn mark before submit is enabled —
 * Playwright mouse moves dispatch the pointer events the canvas listens for.
 */
export async function drawSignature(page: Page, scope: Locator) {
  const canvas = scope.locator("canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  if (!box) throw new Error("signature canvas has no bounding box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx - 40, cy - 10);
  await page.mouse.down();
  await page.mouse.move(cx - 10, cy + 20);
  await page.mouse.move(cx + 25, cy - 15);
  await page.mouse.move(cx + 55, cy + 12);
  await page.mouse.up();
}

/**
 * Complete the §19 SignatureDialog that is currently open: draw the required signature, fill the
 * (optional) reason, re-auth with the password and submit. Waits for the dialog to close.
 */
export async function sign(page: Page, submitLabel: RegExp | string, reason?: string) {
  const dialog = page.locator("div.fixed.inset-0.z-50");
  await expect(dialog).toBeVisible();
  await drawSignature(page, dialog);
  if (reason !== undefined) await dialog.locator("textarea").fill(reason);
  await dialog.locator('input[type="password"]').fill(PASSWORD);
  await dialog.getByRole("button", { name: submitLabel }).click();
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}
