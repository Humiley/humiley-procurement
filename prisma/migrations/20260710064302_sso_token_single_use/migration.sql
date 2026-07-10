-- CreateTable
CREATE TABLE "SsoTokenUse" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SsoTokenUse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SsoTokenUse_expiresAt_idx" ON "SsoTokenUse"("expiresAt");
