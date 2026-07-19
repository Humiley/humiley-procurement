import "server-only";
import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { V1Scope } from "@/lib/api-scopes";

/**
 * §17 token auth for /api/v1 — `Authorization: Bearer hml_<token>`. Only the SHA-256 of the
 * token is stored; the plaintext is shown once at creation.
 */

// The scope vocabulary lives in the client-safe lib/api-scopes; re-exported here for server consumers.
export { V1_SCOPES } from "@/lib/api-scopes";
export type { V1Scope } from "@/lib/api-scopes";

export function mintApiToken(): { token: string; prefix: string; keyHash: string } {
  const token = `hml_${randomBytes(24).toString("base64url")}`;
  return { token, prefix: token.slice(0, 12), keyHash: createHash("sha256").update(token).digest("hex") };
}

/**
 * Authenticate a bearer token and (optionally) authorize it for a specific resource scope. A key with
 * an EMPTY scope list has full access (keys minted before scoping existed); a key with an explicit list
 * may only reach the resources it lists — a narrow key for an accounting integration can be limited to
 * invoices + payment-requests and can't enumerate vendors or requisitions.
 */
export async function requireApiKey(
  req: NextRequest,
  scope?: V1Scope,
): Promise<{ ok: true; keyId: string; scopes: string[] } | { ok: false; res: NextResponse }> {
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
  if (scope && key.scopes.length > 0 && !key.scopes.includes(scope)) {
    return { ok: false, res: NextResponse.json({ error: `This API key is not authorized for the '${scope}' scope` }, { status: 403 }) };
  }
  db.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});
  return { ok: true, keyId: key.id, scopes: key.scopes };
}

/** Common list params: ?take=50&skip=0 (take capped at 200). */
export function listParams(req: NextRequest): { take: number; skip: number } {
  const take = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get("take")) || 50));
  const skip = Math.max(0, Number(req.nextUrl.searchParams.get("skip")) || 0);
  return { take, skip };
}
