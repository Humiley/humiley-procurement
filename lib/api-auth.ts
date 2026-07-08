import "server-only";
import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * §17 token auth for /api/v1 — `Authorization: Bearer hml_<token>`. Only the SHA-256 of the
 * token is stored; the plaintext is shown once at creation.
 */

export function mintApiToken(): { token: string; prefix: string; keyHash: string } {
  const token = `hml_${randomBytes(24).toString("base64url")}`;
  return { token, prefix: token.slice(0, 12), keyHash: createHash("sha256").update(token).digest("hex") };
}

export async function requireApiKey(req: NextRequest): Promise<{ ok: true; keyId: string } | { ok: false; res: NextResponse }> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return { ok: false, res: NextResponse.json({ error: "Missing bearer token" }, { status: 401 }) };
  }
  const keyHash = createHash("sha256").update(token).digest("hex");
  const key = await db.apiKey.findUnique({ where: { keyHash } });
  if (!key || !key.isActive) {
    return { ok: false, res: NextResponse.json({ error: "Invalid or inactive API key" }, { status: 401 }) };
  }
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { ok: true, keyId: key.id };
}

/** Common list params: ?take=50&skip=0 (take capped at 200). */
export function listParams(req: NextRequest): { take: number; skip: number } {
  const take = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("take")) || 50));
  const skip = Math.max(0, Number(req.nextUrl.searchParams.get("skip")) || 0);
  return { take, skip };
}
