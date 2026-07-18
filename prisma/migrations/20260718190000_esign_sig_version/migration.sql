-- Signature hash-scheme version. Existing rows default to 1 (legacy unkeyed SHA-256); new signatures
-- written after the keyed-HMAC upgrade are stamped 2. Lets verifyChain re-verify a v2 chain while
-- grandfathering any v1 rows below it. See lib/esign/sign.ts.
ALTER TABLE "ElectronicSignature" ADD COLUMN "sigVersion" INTEGER NOT NULL DEFAULT 1;
