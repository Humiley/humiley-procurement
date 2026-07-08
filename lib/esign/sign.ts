import "server-only";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { notifyRole } from "@/lib/notify";
import type { SignatureMeaning } from "@prisma/client";

/**
 * §19 e-signature core — 21 CFR Part 11-aligned.
 *
 * Every controlled action (approve/reject/verify/receive/issue/…) is executed through
 * `signRecord`, never a bare button click:
 *  - the signer re-authenticates with their password (a stolen open session cannot sign);
 *  - 3 failed attempts inside 15 minutes lock the account for 15 minutes, write
 *    `SignatureFailure`, and alert every ADMIN;
 *  - the signature stores the SHA-256 of the document's canonical JSON (`recordSnapshotHash`)
 *    plus the previous signature's hash (`prevSignatureHash`) — a tamper-evident chain that
 *    `verifyChain` re-computes.
 */

const LOCK_WINDOW_MS = 15 * 60 * 1000; // failed-attempt window AND lock duration
const MAX_FAILURES = 3;

/** Deterministic JSON: sorted keys, Dates→ISO, Prisma Decimals (and anything else)→String. */
export function canonicalJson(value: unknown): string {
  const norm = (v: unknown): unknown => {
    if (v === null || v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    if (Array.isArray(v)) return v.map(norm);
    if (typeof v === "object") {
      // Prisma Decimal (and similar wrappers) stringify cleanly
      if ("toFixed" in (v as Record<string, unknown>) && typeof (v as { toFixed?: unknown }).toFixed === "function") {
        return String(v);
      }
      return Object.keys(v as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((acc, k) => {
          acc[k] = norm((v as Record<string, unknown>)[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(norm(value));
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

type SigRow = {
  userId: string;
  entityType: string;
  entityId: string;
  meaning: SignatureMeaning;
  signedAt: Date;
  fullNamePrinted: string;
  recordSnapshotHash: string;
  prevSignatureHash: string | null;
};

/** The hash OF a signature row — what the next link in the chain stores as prevSignatureHash. */
export function signatureHash(row: SigRow): string {
  return sha256Hex(
    canonicalJson([
      row.userId,
      row.entityType,
      row.entityId,
      row.meaning,
      row.signedAt.toISOString(),
      row.fullNamePrinted,
      row.recordSnapshotHash,
      row.prevSignatureHash ?? "",
    ]),
  );
}

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignatureError";
  }
}

/**
 * Execute the signing ceremony. Throws SignatureError with a user-facing message on failure.
 * Returns the created ElectronicSignature row.
 */
export async function signRecord(params: {
  userId: string;
  password: string;
  entityType: string; // e.g. "PurchaseRequisition"
  entityId: string;
  meaning: SignatureMeaning;
  reason?: string | null;
  record: unknown; // the document's canonical content at the moment of signing
}) {
  const user = await db.user.findUnique({ where: { id: params.userId } });
  if (!user || !user.isActive) throw new SignatureError("Account is not active.");
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new SignatureError("Account is locked after failed signature attempts. Try again later.");
  }

  const ok = await bcrypt.compare(params.password, user.passwordHash);
  if (!ok) {
    await db.signatureFailure.create({
      data: { userId: user.id, entityType: params.entityType, entityId: params.entityId },
    });
    const windowStart = new Date(Date.now() - LOCK_WINDOW_MS);
    const recent = await db.signatureFailure.count({
      where: { userId: user.id, attemptedAt: { gte: windowStart } },
    });
    if (recent >= MAX_FAILURES) {
      await db.user.update({
        where: { id: user.id },
        data: { lockedUntil: new Date(Date.now() + LOCK_WINDOW_MS) },
      });
      await notifyRole("ADMIN", {
        titleEn: `Signature lockout: ${user.name}`,
        titleVn: `Khoá ký điện tử: ${user.name}`,
        bodyEn: `${MAX_FAILURES} failed signature attempts on ${params.entityType} ${params.entityId}. Account locked for 15 minutes.`,
        bodyVn: `${MAX_FAILURES} lần ký thất bại trên ${params.entityType} ${params.entityId}. Tài khoản bị khoá 15 phút.`,
      });
      throw new SignatureError("Too many failed attempts — account locked for 15 minutes.");
    }
    throw new SignatureError("Password is incorrect. This attempt has been recorded.");
  }

  const recordSnapshotHash = sha256Hex(canonicalJson(params.record));

  // Tamper-evident chain: link to the hash of the entity's latest signature.
  const prev = await db.electronicSignature.findFirst({
    where: { entityType: params.entityType, entityId: params.entityId },
    orderBy: { signedAt: "desc" },
  });
  const prevSignatureHash = prev
    ? signatureHash({
        userId: prev.userId,
        entityType: prev.entityType,
        entityId: prev.entityId,
        meaning: prev.meaning,
        signedAt: prev.signedAt,
        fullNamePrinted: prev.fullNamePrinted,
        recordSnapshotHash: prev.recordSnapshotHash,
        prevSignatureHash: prev.prevSignatureHash,
      })
    : null;

  // signedAt is written explicitly so the stored row hashes identically at verify time.
  return db.electronicSignature.create({
    data: {
      userId: user.id,
      entityType: params.entityType,
      entityId: params.entityId,
      meaning: params.meaning,
      signedAt: new Date(),
      fullNamePrinted: user.name,
      reason: params.reason || null,
      recordSnapshotHash,
      prevSignatureHash,
    },
  });
}

/** Re-verify the whole signature chain of one entity. Returns the first broken link, if any. */
export async function verifyChain(entityType: string, entityId: string) {
  const sigs = await db.electronicSignature.findMany({
    where: { entityType, entityId },
    orderBy: { signedAt: "asc" },
  });
  let expectedPrev: string | null = null;
  for (const s of sigs) {
    if ((s.prevSignatureHash ?? null) !== expectedPrev) {
      return { ok: false as const, brokenAt: s.id };
    }
    expectedPrev = signatureHash({
      userId: s.userId,
      entityType: s.entityType,
      entityId: s.entityId,
      meaning: s.meaning,
      signedAt: s.signedAt,
      fullNamePrinted: s.fullNamePrinted,
      recordSnapshotHash: s.recordSnapshotHash,
      prevSignatureHash: s.prevSignatureHash,
    });
  }
  return { ok: true as const, count: sigs.length };
}
