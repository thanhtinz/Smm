-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "assigneeId" TEXT,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "mergedIntoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ticket_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ticket_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Ticket" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ticket" ("assigneeId", "category", "createdAt", "id", "panelId", "priority", "publicId", "status", "subject", "updatedAt", "userId") SELECT "assigneeId", "category", "createdAt", "id", "panelId", "priority", "publicId", "status", "subject", "updatedAt", "userId" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");
CREATE INDEX "Ticket_panelId_idx" ON "Ticket"("panelId");
CREATE INDEX "Ticket_panelId_priority_updatedAt_idx" ON "Ticket"("panelId", "priority", "updatedAt");
CREATE INDEX "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");
CREATE INDEX "Ticket_mergedIntoId_idx" ON "Ticket"("mergedIntoId");
CREATE UNIQUE INDEX "Ticket_panelId_publicId_key" ON "Ticket"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
