import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { createHash, randomBytes } from "crypto";

test("v1 API: 401 without a key, JSON with one", async ({ request }) => {
  const noAuth = await request.get("/api/v1/vendors");
  expect(noAuth.status()).toBe(401);

  // mint a key directly (hash-only storage, same as the console does)
  const db = new PrismaClient();
  const token = `hml_${randomBytes(24).toString("base64url")}`;
  const admin = await db.user.findFirstOrThrow({ where: { email: "admin@humiley.com" } });
  await db.apiKey.create({
    data: {
      name: "e2e",
      prefix: token.slice(0, 12),
      keyHash: createHash("sha256").update(token).digest("hex"),
      createdById: admin.id,
    },
  });
  await db.$disconnect();

  const ok = await request.get("/api/v1/vendors", { headers: { Authorization: `Bearer ${token}` } });
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(Array.isArray(body.data)).toBe(true);
  expect(body.data.some((v: { code: string }) => v.code === "V-CLEAN01")).toBe(true);

  const spec = await request.get("/api/v1/openapi");
  expect(spec.status()).toBe(200);
  expect((await spec.json()).openapi).toBe("3.0.3");
});
