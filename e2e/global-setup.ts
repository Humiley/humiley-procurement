import { execSync } from "child_process";

/** Fresh deterministic data for every run — the demo seed IS the test fixture. */
export default function globalSetup() {
  execSync("npm run seed", {
    stdio: "inherit",
    env: { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: "1" },
  });
}
