-- CreateEnum
CREATE TYPE "ModeratorActionKind" AS ENUM ('answer', 'pause', 'unpause');

-- AlterTable
ALTER TABLE "Proof" ADD COLUMN     "removedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "keepProofDays" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "recoveryHash" TEXT,
ADD COLUMN     "totpLastStep" INTEGER,
ADD COLUMN     "totpSecret" TEXT;

-- CreateTable
CREATE TABLE "ModeratorAction" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "action" "ModeratorActionKind" NOT NULL,
    "reportId" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModeratorAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ModeratorAction_reportId_idx" ON "ModeratorAction"("reportId");
