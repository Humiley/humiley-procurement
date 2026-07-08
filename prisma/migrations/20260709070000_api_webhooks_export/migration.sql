CREATE TABLE "ApiKey" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "prefix" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMP(3),
  CONSTRAINT "ApiKey_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

CREATE TABLE "WebhookSubscription" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "url" TEXT NOT NULL,
  "events" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "secret" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ExportBatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "batchNumber" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "rowCount" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExportBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ExportBatch_batchNumber_key" ON "ExportBatch"("batchNumber");

ALTER TABLE "Invoice" ADD COLUMN "exportBatchId" TEXT;
ALTER TABLE "PaymentRequest" ADD COLUMN "exportBatchId" TEXT;
