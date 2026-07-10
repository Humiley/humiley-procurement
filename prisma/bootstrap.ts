/**
 * PRODUCTION bootstrap — safe to run against an empty (or existing) prod DB.
 *
 * Unlike `npm run seed` (which does `prisma migrate reset --force` and injects demo data +
 * shared-password accounts), this NEVER drops anything and never creates demo records. It only
 * ensures the minimum a fresh install needs to function:
 *   1. the §6 approval matrix (PR/PO/VENDOR/PAYMENT_REQUEST/GOODS_ISSUE bands), and
 *   2. exactly one ADMIN user from env, with a random one-time password (mustChangePw=true).
 *
 * Run once after `prisma migrate deploy`:
 *   BOOTSTRAP_ADMIN_EMAIL=admin@humiley.com BOOTSTRAP_ADMIN_NAME="System Administrator" \
 *     npx tsx prisma/bootstrap.ts
 * It prints the generated admin password ONCE. Re-running is idempotent (no duplicate matrix,
 * existing admin left untouched).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateTempPassword } from "../lib/schemas/user";

const db = new PrismaClient();

const MATRIX = [
  { entityType: "PR", minAmountVnd: 0, maxAmountVnd: 19_999_999, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PR", minAmountVnd: 20_000_000, maxAmountVnd: 200_000_000, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PR", minAmountVnd: 20_000_000, maxAmountVnd: 200_000_000, level: 2, approverRole: "DIRECTOR" },
  { entityType: "PR", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PR", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 2, approverRole: "DIRECTOR" },
  { entityType: "PR", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 3, approverRole: "DIRECTOR" },
  { entityType: "PO", minAmountVnd: 0, maxAmountVnd: 19_999_999, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PO", minAmountVnd: 20_000_000, maxAmountVnd: 200_000_000, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PO", minAmountVnd: 20_000_000, maxAmountVnd: 200_000_000, level: 2, approverRole: "DIRECTOR" },
  { entityType: "PO", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PO", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 2, approverRole: "DIRECTOR" },
  { entityType: "PO", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 3, approverRole: "DIRECTOR" },
  { entityType: "VENDOR", minAmountVnd: 0, maxAmountVnd: null, level: 1, approverRole: "DIRECTOR" },
  { entityType: "PAYMENT_REQUEST", minAmountVnd: 0, maxAmountVnd: 19_999_999, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PAYMENT_REQUEST", minAmountVnd: 20_000_000, maxAmountVnd: 200_000_000, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PAYMENT_REQUEST", minAmountVnd: 20_000_000, maxAmountVnd: 200_000_000, level: 2, approverRole: "ACCOUNTANT" },
  { entityType: "PAYMENT_REQUEST", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 1, approverRole: "DEPT_MANAGER" },
  { entityType: "PAYMENT_REQUEST", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 2, approverRole: "ACCOUNTANT" },
  { entityType: "PAYMENT_REQUEST", minAmountVnd: 200_000_001, maxAmountVnd: null, level: 3, approverRole: "DIRECTOR" },
  { entityType: "GOODS_ISSUE", minAmountVnd: 0, maxAmountVnd: null, level: 1, approverRole: "DEPT_MANAGER" },
] as const;

async function main() {
  // 1) approval matrix — only if none exists (idempotent; never disturbs a customized matrix)
  const existingMatrix = await db.approvalMatrix.count();
  if (existingMatrix === 0) {
    await db.approvalMatrix.createMany({ data: MATRIX as never });
    console.log(`✓ Seeded ${MATRIX.length} approval-matrix bands.`);
  } else {
    console.log(`• Approval matrix already has ${existingMatrix} rows — left untouched.`);
  }

  // 2) exactly one admin, from env, with a random one-time password
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || "").toLowerCase().trim();
  if (!email) {
    console.log("• BOOTSTRAP_ADMIN_EMAIL not set — skipping admin creation.");
  } else {
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`• Admin ${email} already exists — left untouched.`);
    } else {
      const tempPassword = generateTempPassword();
      await db.user.create({
        data: {
          name: process.env.BOOTSTRAP_ADMIN_NAME || "System Administrator",
          email,
          passwordHash: await bcrypt.hash(tempPassword, 10),
          roles: ["ADMIN"],
          isActive: true,
          mustChangePw: true,
        },
      });
      console.log("\n================ FIRST ADMIN CREATED ================");
      console.log(`  email:    ${email}`);
      console.log(`  password: ${tempPassword}`);
      console.log("  (change required at first sign-in — this is shown only once)");
      console.log("====================================================\n");
    }
  }
}

main()
  .catch((e) => {
    console.error("Bootstrap failed:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
