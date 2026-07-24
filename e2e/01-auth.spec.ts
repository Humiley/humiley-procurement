import { test, expect } from "@playwright/test";
import { login, logout } from "./helpers";

test("rejects a wrong password", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"], input[name="email"]').fill("admin@humiley.com");
  await page.locator('input[type="password"]').fill("wrong-password");
  await page.locator('button[type="submit"]').click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 15_000 });
});

test("signs in and out", async ({ page }) => {
  await login(page, "admin@humiley.com");
  await expect(page.getByText(/welcome, system administrator/i)).toBeVisible();
  await logout(page);
  await page.goto("/dashboard");
  await page.waitForURL(/login/);
});
