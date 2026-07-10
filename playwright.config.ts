import { defineConfig } from "@playwright/test";

/**
 * §22 e2e suite — runs against the dev server on :3000 (reused if already running).
 * Serial single worker: the journeys share one seeded database.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:3000",
    trace: "retain-on-failure",
    locale: "en-US",
  },
  webServer: {
    // Run the suite WITHOUT the /procurement basePath (a deploy-only concern) so the specs keep
    // using root paths. The app logic is identical either way; basePath routing is verified
    // separately. BASE_PATH="" wins over the "/procurement" default in next.config.mjs.
    command: "npm run dev",
    env: { BASE_PATH: "" },
    url: "http://localhost:3000/login",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
