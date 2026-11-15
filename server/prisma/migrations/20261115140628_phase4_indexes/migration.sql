-- DropIndex
DROP INDEX "RewardRequest_parentId_idx";

-- DropIndex
DROP INDEX "Task_childId_idx";

-- CreateIndex
CREATE INDEX "Report_resolvedAt_sentAt_idx" ON "Report"("resolvedAt", "sentAt");

-- CreateIndex
CREATE INDEX "RewardRequest_parentId_status_idx" ON "RewardRequest"("parentId", "status");

-- CreateIndex
CREATE INDEX "Task_childId_status_idx" ON "Task"("childId", "status");
