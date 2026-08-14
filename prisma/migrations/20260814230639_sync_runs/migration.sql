-- CreateTable
CREATE TABLE "SyncRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "dispatched" INTEGER NOT NULL DEFAULT 0,
    "synced" INTEGER NOT NULL DEFAULT 0,
    "mailed" INTEGER NOT NULL DEFAULT 0,
    "failures" TEXT NOT NULL DEFAULT '',
    "trigger" TEXT NOT NULL DEFAULT 'cron'
);

-- CreateIndex
CREATE INDEX "SyncRun_startedAt_idx" ON "SyncRun"("startedAt");
