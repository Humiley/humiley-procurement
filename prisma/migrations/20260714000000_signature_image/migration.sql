-- Optional hand-drawn signature image (visual mark) captured in the sign dialog.
-- Nullable, so existing signatures are unaffected and it is NOT part of the hash chain.
ALTER TABLE "ElectronicSignature" ADD COLUMN "imageData" TEXT;
