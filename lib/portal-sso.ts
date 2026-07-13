import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Single-sign-on handoff from the Humiley Portal. Procurement is an APP OF THE PORTAL (like HR
 * and CRM) — a user who is already signed in to the portal via Microsoft 365 must NOT be asked
 * to log in again. The portal's backend mints a short-lived token signed with a secret shared by
 * both apps (PORTAL_SSO_SECRET); this verifies it and yields the identity, so procurement can
 * open an authenticated session with no password prompt.
 *
 * Token: base64url(JSON{email,name,exp}) + "." + base64url(HMAC-SHA256(secret, payloadB64)).
 * The HMAC covers the base64 payload STRING, so both languages sign identical bytes (no JSON
 * canonicalization needed). exp is a unix second; tokens live ~2 minutes.
 */
export type PortalIdentity = { email: string; name: string; role?: string; tokenId: string; expiresAt: Date };

const SECRET = process.env.PORTAL_SSO_SECRET || "";

function b64urlToBuf(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function verifyPortalToken(token: string): PortalIdentity | null {
  if (!SECRET || !token || SECRET.length < 16) return null; // refuse if not configured
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  const expected = createHmac("sha256", SECRET).update(payloadB64).digest();
  const got = b64urlToBuf(sigB64);
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;

  let claims: { email?: string; name?: string; role?: string; exp?: number };
  try {
    claims = JSON.parse(b64urlToBuf(payloadB64).toString("utf8"));
  } catch {
    return null;
  }
  if (!claims.email || !claims.exp) return null;
  if (Date.now() / 1000 > claims.exp) return null; // expired
  // tokenId = SHA-256 of the whole token — the caller records it once (unique insert) to make
  // the token single-use, closing the replay window.
  const tokenId = createHash("sha256").update(token).digest("hex");
  return {
    email: String(claims.email).toLowerCase().trim(),
    name: String(claims.name || claims.email),
    // Optional procurement role assigned from the portal's Access & Permissions page; when present
    // it is applied to the user on sign-in (see lib/auth.ts). Absent/blank → role managed here.
    role: claims.role ? String(claims.role).toUpperCase().trim() : undefined,
    tokenId,
    expiresAt: new Date(claims.exp * 1000),
  };
}
