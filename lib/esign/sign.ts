import "server-only";
import { createHash, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { notifyRole } from "@/lib/notify";
import type { SignatureMeaning } from "@prisma/client";

// Keyed-MAC signing key, derived from a secret held OUTSIDE the signatures' database (env, never a
// column). A plain SHA-256 chain is only tamper-EVIDENT against an edit-and-forget: anyone who can
// write rows (SQLi sink, a malicious/compromised DBA, an edited backup) could recompute a fully
// self-consistent chain and forge an APPROVED/VERIFIED signature. HMAC makes the chain un-forgeable
// without the key. We prefer a dedicated ESIGN_SIGNING_SECRET but fall back to AUTH_SECRET (always
// present in production) so the protection is active immediately; a distinct sub-key is derived so the
// two secrets never share raw material. When neither is set (local dev/test) we fall back to the legacy
// unkeyed hash so nothing breaks — signatures made then are marked v1.
const ESIGN_RAW_SECRET = process.env.ESIGN_SIGNING_SECRET || process.env.AUTH_SECRET || "";
const ESIGN_KEY = ESIGN_RAW_SECRET
  ? createHmac("sha256", ESIGN_RAW_SECRET).update("humiley-esign-chain-v2").digest("hex")
  : "";
/** Signature hash-scheme version: 2 = keyed HMAC-SHA256 (binds `reason`); 1 = legacy unkeyed SHA-256. */
const SIG_VERSION = ESIGN_KEY ? 2 : 1;

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

function hmacHex(s: string): string {
  return createHmac("sha256", ESIGN_KEY).update(s, "utf8").digest("hex");
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
  reason?: string | null;
  sigVersion?: number | null;
};

/**
 * The hash OF a signature row — what the next link in the chain stores as prevSignatureHash, and what
 * selfHash pins. The scheme is chosen per-row by its `sigVersion`, so a v2 (HMAC) chain and any legacy
 * v1 (SHA-256) rows below it both re-verify correctly:
 *  - v2: keyed HMAC-SHA256 that ALSO binds `reason` (the override/justification), which v1 never hashed;
 *  - v1: the original unkeyed SHA-256 over the same fields WITHOUT reason (kept byte-compatible).
 */
export function signatureHash(row: SigRow): string {
  const fields: unknown[] = [
    row.userId,
    row.entityType,
    row.entityId,
    row.meaning,
    row.signedAt.toISOString(),
    row.fullNamePrinted,
    row.recordSnapshotHash,
    row.prevSignatureHash ?? "",
  ];
  if ((row.sigVersion ?? 1) >= 2) {
    // v2 binds the reason into the keyed MAC so a single-column UPDATE of `reason` no longer goes
    // undetected. Requires the key — a missing key at verify time is a config error, not a silent pass.
    fields.push(row.reason ?? "");
    if (!ESIGN_KEY) throw new SignatureError("E-signature key (ESIGN_SIGNING_SECRET / AUTH_SECRET) is not configured.");
    return hmacHex(canonicalJson(fields));
  }
  return sha256Hex(canonicalJson(fields));
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
  imageData?: string | null; // optional hand-drawn signature PNG (visual mark; not in the hash)
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

  // Read-prev + insert must be serialized per entity, or two concurrent signatures both link
  // to the same prev and FORK the chain (verifyChain would then flag an honest race as
  // tampering). A pg advisory transaction lock on (entityType, entityId) makes the chain append
  // strictly sequential without blocking signatures on other entities.
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${params.entityType + ":" + params.entityId}))`;

    // Tamper-evident chain: link to the hash of the entity's latest signature. The id tiebreak keeps
    // "latest" deterministic if two rows ever share a millisecond signedAt (the advisory lock above
    // already serializes appends, so ids are in creation order).
    const prev = await tx.electronicSignature.findFirst({
      where: { entityType: params.entityType, entityId: params.entityId },
      orderBy: [{ signedAt: "desc" }, { id: "desc" }],
    });
    // Hash the previous link using ITS OWN scheme (a v2 chain may sit above legacy v1 rows).
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
          reason: prev.reason,
          sigVersion: prev.sigVersion,
        })
      : null;

    // signedAt is written explicitly so the stored row hashes identically at verify time.
    // selfHash makes every row independently verifiable — without it, tampering the LAST
    // link of a chain (nothing references its hash yet) would be undetectable.
    const signedAt = new Date();
    const row: SigRow = {
      userId: user.id,
      entityType: params.entityType,
      entityId: params.entityId,
      meaning: params.meaning,
      signedAt,
      fullNamePrinted: user.name,
      recordSnapshotHash,
      prevSignatureHash,
      reason: params.reason || null,
      sigVersion: SIG_VERSION,
    };
    // Bound the optional drawn signature so a record can't be bloated; auth/integrity are
    // unaffected if it is missing or oversized (it is a visual mark, not part of the hash).
    const imageData =
      typeof params.imageData === "string" &&
      params.imageData.startsWith("data:image/png;base64,") &&
      params.imageData.length <= 260000
        ? params.imageData
        : null;
    return tx.electronicSignature.create({
      data: {
        userId: row.userId,
        entityType: row.entityType,
        entityId: row.entityId,
        meaning: row.meaning,
        signedAt: row.signedAt,
        fullNamePrinted: row.fullNamePrinted,
        recordSnapshotHash: row.recordSnapshotHash,
        prevSignatureHash: row.prevSignatureHash,
        reason: row.reason,
        sigVersion: SIG_VERSION,
        selfHash: signatureHash(row),
        imageData,
      },
    });
  });
}

/**
 * Re-verify the whole signature chain of one entity. Returns the first broken link, if any.
 *
 * The chain is walked by FOLLOWING the prev-hash POINTERS from the root, not by sorting on signedAt —
 * two signatures that happen to share a millisecond timestamp (millisecond-resolution `new Date()`)
 * would otherwise sort non-deterministically and could false-flag an honest chain as tampered. The
 * pointer walk is order-independent and additionally catches a missing/duplicate root, a fork (two
 * rows claiming the same predecessor), a cycle, and orphaned rows.
 */
export async function verifyChain(entityType: string, entityId: string) {
  const sigs = await db.electronicSignature.findMany({ where: { entityType, entityId } });
  if (sigs.length === 0) return { ok: true as const, count: 0 };
  type Row = (typeof sigs)[number];

  // 1) Recompute each row's hash (the value its successor stores as prevSignatureHash) and pin its
  //    selfHash. Index rows by the prevSignatureHash they declare, so the chain can be walked forward.
  const hashOf = new Map<string, string>(); // row.id -> recomputed hash
  const byPrev = new Map<string | null, Row[]>(); // declared prevSignatureHash -> rows that declare it
  for (const s of sigs) {
    let h: string;
    try {
      h = signatureHash({
        userId: s.userId,
        entityType: s.entityType,
        entityId: s.entityId,
        meaning: s.meaning,
        signedAt: s.signedAt,
        fullNamePrinted: s.fullNamePrinted,
        recordSnapshotHash: s.recordSnapshotHash,
        prevSignatureHash: s.prevSignatureHash,
        reason: s.reason,
        sigVersion: s.sigVersion,
      });
    } catch {
      // A v2 (HMAC) row can't be re-verified without the key — a deployment/config problem, not a pass.
      return { ok: false as const, brokenAt: s.id, unverifiable: true as const };
    }
    // selfHash pins the row's own content (catches tampering of a tail row nothing references yet);
    // legacy rows without selfHash rely on the prev-hash pointer walk alone.
    if (s.selfHash && s.selfHash !== h) return { ok: false as const, brokenAt: s.id };
    hashOf.set(s.id, h);
    const key = s.prevSignatureHash ?? null;
    const arr = byPrev.get(key);
    if (arr) arr.push(s);
    else byPrev.set(key, [s]);
  }

  // 2) Exactly one root (prevSignatureHash == null).
  const roots = byPrev.get(null) ?? [];
  if (roots.length !== 1) return { ok: false as const, brokenAt: (roots[1] ?? sigs[0]).id };

  // 3) Follow the pointers: a link's successor is the row whose prevSignatureHash equals this row's
  //    recomputed hash. Any fork (>1 successor) or cycle breaks the chain.
  const seen = new Set<string>();
  let current: Row | undefined = roots[0];
  while (current) {
    if (seen.has(current.id)) return { ok: false as const, brokenAt: current.id }; // cycle
    seen.add(current.id);
    const nexts: Row[] = byPrev.get(hashOf.get(current.id)!) ?? [];
    if (nexts.length > 1) return { ok: false as const, brokenAt: nexts[1].id }; // fork
    current = nexts[0];
  }

  // 4) Every row must be reachable from the root (no orphan dangling off a tampered parent).
  if (seen.size !== sigs.length) {
    const orphan = sigs.find((s) => !seen.has(s.id));
    return { ok: false as const, brokenAt: (orphan ?? sigs[0]).id };
  }
  return { ok: true as const, count: sigs.length };
}
