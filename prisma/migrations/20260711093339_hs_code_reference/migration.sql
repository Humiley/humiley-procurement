-- AlterTable
ALTER TABLE "HsCode" ADD COLUMN     "category" TEXT,
ADD COLUMN     "dutyVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "keywords" TEXT;
