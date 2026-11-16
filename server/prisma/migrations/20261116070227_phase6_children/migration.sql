-- CreateEnum
CREATE TYPE "SuggestionStatus" AS ENUM ('open', 'accepted', 'declined');

-- AlterTable
ALTER TABLE "RewardRequest" ADD COLUMN     "answerSeen" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "agreedAt" TIMESTAMP(3),
ADD COLUMN     "goalRewardId" TEXT;

-- CreateTable
CREATE TABLE "Suggestion" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "ideaId" TEXT NOT NULL,
    "status" "SuggestionStatus" NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Suggestion_childId_status_idx" ON "Suggestion"("childId", "status");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_goalRewardId_fkey" FOREIGN KEY ("goalRewardId") REFERENCES "Reward"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
