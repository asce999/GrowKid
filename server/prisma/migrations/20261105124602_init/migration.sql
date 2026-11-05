-- CreateEnum
CREATE TYPE "Role" AS ENUM ('parent', 'child', 'moderator');

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('chores', 'study', 'reading', 'creative', 'outdoors', 'health');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('todo', 'review', 'sentBack', 'approved');

-- CreateEnum
CREATE TYPE "ReviewResult" AS ENUM ('approved', 'sentBack');

-- CreateEnum
CREATE TYPE "CheerKind" AS ENUM ('proud', 'tidy', 'brave', 'clever', 'kind', 'effort');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('requested', 'given', 'declined');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "tokenVersion" INTEGER NOT NULL DEFAULT 0,
    "leaderboard" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "points" INTEGER NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'todo',
    "resultSeen" BOOLEAN NOT NULL DEFAULT true,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proof" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "fileName" TEXT,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "late" BOOLEAN NOT NULL,
    "result" "ReviewResult",
    "reviewNote" TEXT NOT NULL DEFAULT '',
    "reviewBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "cheerKind" "CheerKind",
    "cheerLine" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Proof_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Award" (
    "childId" TEXT NOT NULL,
    "stickerId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,

    CONSTRAINT "Award_pkey" PRIMARY KEY ("childId","stickerId")
);

-- CreateTable
CREATE TABLE "Quest" (
    "childId" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL,
    "surprise" TEXT,
    "setAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quest_pkey" PRIMARY KEY ("childId")
);

-- CreateTable
CREATE TABLE "QuestAward" (
    "childId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "bonus" INTEGER NOT NULL,
    "surprise" TEXT,
    "earnedAt" TIMESTAMP(3) NOT NULL,
    "taskId" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,

    CONSTRAINT "QuestAward_pkey" PRIMARY KEY ("childId","week")
);

-- CreateTable
CREATE TABLE "RestDay" (
    "childId" TEXT NOT NULL,
    "day" TEXT NOT NULL,

    CONSTRAINT "RestDay_pkey" PRIMARY KEY ("childId","day")
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RewardRequest" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "parentId" TEXT NOT NULL,
    "rewardId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cost" INTEGER NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'requested',
    "note" TEXT NOT NULL DEFAULT '',
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "answeredBy" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "RewardRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "byId" TEXT,
    "from" "Role" NOT NULL,
    "details" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "item" JSONB,
    "resolutionNote" TEXT,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "User_parentId_idx" ON "User"("parentId");

-- CreateIndex
CREATE INDEX "Task_childId_idx" ON "Task"("childId");

-- CreateIndex
CREATE INDEX "Proof_taskId_idx" ON "Proof"("taskId");

-- CreateIndex
CREATE INDEX "Reward_parentId_idx" ON "Reward"("parentId");

-- CreateIndex
CREATE INDEX "RewardRequest_childId_idx" ON "RewardRequest"("childId");

-- CreateIndex
CREATE INDEX "RewardRequest_parentId_idx" ON "RewardRequest"("parentId");

-- CreateIndex
CREATE INDEX "Report_byId_idx" ON "Report"("byId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proof" ADD CONSTRAINT "Proof_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Award" ADD CONSTRAINT "Award_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestAward" ADD CONSTRAINT "QuestAward_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestDay" ADD CONSTRAINT "RestDay_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reward" ADD CONSTRAINT "Reward_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRequest" ADD CONSTRAINT "RewardRequest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RewardRequest" ADD CONSTRAINT "RewardRequest_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_byId_fkey" FOREIGN KEY ("byId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
