-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Panel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT NOT NULL DEFAULT '',
    "ownerUserId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusNote" TEXT NOT NULL DEFAULT '',
    "webhookToken" TEXT NOT NULL DEFAULT '',
    "rentPrice" REAL,
    "nextDueAt" DATETIME,
    "lastBilledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Panel_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Panel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Panel" ("createdAt", "depth", "id", "lastBilledAt", "name", "nextDueAt", "ownerUserId", "parentId", "path", "rentPrice", "slug", "status", "statusNote", "updatedAt") SELECT "createdAt", "depth", "id", "lastBilledAt", "name", "nextDueAt", "ownerUserId", "parentId", "path", "rentPrice", "slug", "status", "statusNote", "updatedAt" FROM "Panel";
DROP TABLE "Panel";
ALTER TABLE "new_Panel" RENAME TO "Panel";
CREATE UNIQUE INDEX "Panel_slug_key" ON "Panel"("slug");
CREATE INDEX "Panel_parentId_idx" ON "Panel"("parentId");
CREATE INDEX "Panel_path_idx" ON "Panel"("path");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
