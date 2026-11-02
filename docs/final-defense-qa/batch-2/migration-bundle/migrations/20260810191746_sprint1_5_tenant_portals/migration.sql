-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "careersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "logoUrl" TEXT;
