-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PanelDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT NOT NULL DEFAULT '',
    "dnsRecordId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PanelDomain_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PanelDomain" ("createdAt", "host", "id", "isPrimary", "panelId", "verified", "verifyToken") SELECT "createdAt", "host", "id", "isPrimary", "panelId", "verified", "verifyToken" FROM "PanelDomain";
DROP TABLE "PanelDomain";
ALTER TABLE "new_PanelDomain" RENAME TO "PanelDomain";
CREATE UNIQUE INDEX "PanelDomain_host_key" ON "PanelDomain"("host");
CREATE INDEX "PanelDomain_panelId_idx" ON "PanelDomain"("panelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
