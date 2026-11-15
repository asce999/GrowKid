-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "doneLooksLike" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "seriesDay" TEXT,
ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "TaskSeries" (
    "id" TEXT NOT NULL,
    "childId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "title" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "doneLooksLike" TEXT NOT NULL DEFAULT '',
    "points" INTEGER NOT NULL,
    "weekdays" INTEGER NOT NULL,
    "dueTime" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TaskSeries_childId_idx" ON "TaskSeries"("childId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_seriesId_seriesDay_key" ON "Task"("seriesId", "seriesDay");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TaskSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSeries" ADD CONSTRAINT "TaskSeries_childId_fkey" FOREIGN KEY ("childId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

