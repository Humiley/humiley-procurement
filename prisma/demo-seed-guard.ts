/**
 * Refuses to run the DEMO seed against a database that holds real accounts.
 *
 * `npm run seed` is `prisma migrate reset --force` — it drops every table — and `prisma/seed.ts`
 * then creates ten accounts that share one published password, and deletes + rewrites the
 * approval matrix. Both are correct on a laptop and a disaster on the live database, and before
 * this guard nothing but the README's "dev only" stood between them.
 *
 * Why the test is "is every account still an untouched demo account", not "is the email a demo
 * email": bootstrap.ts documents `BOOTSTRAP_ADMIN_EMAIL=admin@humiley.com`, which IS a demo email,
 * so a production database holding only its first admin would look like a demo database by email.
 * A real account is one whose password is not the demo password — the bootstrap admin (random
 * one-time password), portal single-sign-on users (random hash, lib/auth.ts), anyone created in
 * Admin → Users, and any demo account somebody changed the password of and started using.
 *
 * `NODE_ENV=production` refuses too, but it is not the real line: the setup containers in
 * docker-compose run the `builder` stage, where NODE_ENV is not set.
 *
 * Deliberate override for a local database you know you want wiped: ALLOW_DEMO_SEED=1.
 *
 * Run standalone (package.json runs this BEFORE `migrate reset`, because once the reset has run
 * there is nothing left to protect):  tsx prisma/demo-seed-guard.ts
 */
import { Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

/** Published in README.md for local development. Never valid outside a demo database. */
export const DEMO_PASSWORD = "Humiley@2026";

export async function refuseUnlessDemoDatabase(db: PrismaClient): Promise<void> {
  if (process.env.ALLOW_DEMO_SEED === "1") {
    console.warn("⚠ ALLOW_DEMO_SEED=1 — demo-seed guard skipped.");
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the demo seed: NODE_ENV=production.");
  }

  let users: Array<{ passwordHash: string }>;
  try {
    users = await db.user.findMany({ select: { passwordHash: true } });
  } catch (e) {
    // A database with no User table yet (created, never migrated) holds nothing to protect.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") return;
    // Anything else fails closed: unreachable, bad credentials, and a database that does not exist
    // yet (Prisma 6 reports that with no error code to tell it apart). `prisma migrate deploy`
    // creates the database, and README's quickstart runs it before `npm run seed`.
    throw e;
  }

  let real = 0;
  for (const u of users) {
    if (!(await bcrypt.compare(DEMO_PASSWORD, u.passwordHash))) real++;
  }
  if (real > 0) {
    throw new Error(
      `Refusing to run the demo seed: this database has ${real} account(s) whose password is not ` +
        "the demo password, so it is not a demo database. Nothing was changed. If this really is " +
        "a local database you want wiped, re-run with ALLOW_DEMO_SEED=1.",
    );
  }
}

if (require.main === module) {
  const db = new PrismaClient();
  refuseUnlessDemoDatabase(db)
    .then(() => db.$disconnect())
    .catch(async (e) => {
      console.error(e instanceof Error ? e.message : e);
      await db.$disconnect();
      process.exit(1);
    });
}
