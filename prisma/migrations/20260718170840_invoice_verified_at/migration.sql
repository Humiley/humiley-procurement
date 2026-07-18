-- Add verifiedAt guard column: set once (atomically) when the 3-way match is e-signed.
ALTER TABLE "Invoice" ADD COLUMN "verifiedAt" TIMESTAMP(3);
