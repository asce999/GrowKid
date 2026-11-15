-- AlterTable
ALTER TABLE "User" ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "pausedAt" TIMESTAMP(3);
