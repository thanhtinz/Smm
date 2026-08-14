-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "balance" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastSyncAt" DATETIME,
    "autoSync" BOOLEAN NOT NULL DEFAULT false,
    "syncEveryHours" INTEGER NOT NULL DEFAULT 12,
    "markupPercent" REAL NOT NULL DEFAULT 60,
    "alertPercent" REAL NOT NULL DEFAULT 25,
    "lowBalance" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Provider_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Provider" ("apiKey", "apiUrl", "balance", "createdAt", "currency", "enabled", "id", "lastSyncAt", "name", "panelId") SELECT "apiKey", "apiUrl", "balance", "createdAt", "currency", "enabled", "id", "lastSyncAt", "name", "panelId" FROM "Provider";
DROP TABLE "Provider";
ALTER TABLE "new_Provider" RENAME TO "Provider";
CREATE INDEX "Provider_panelId_idx" ON "Provider"("panelId");
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerServiceId" TEXT NOT NULL DEFAULT '',
    "sourceServiceId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'default',
    "rate" REAL NOT NULL,
    "providerRate" REAL NOT NULL DEFAULT 0,
    "autoPrice" BOOLEAN NOT NULL DEFAULT false,
    "missingSince" DATETIME,
    "min" INTEGER NOT NULL DEFAULT 10,
    "max" INTEGER NOT NULL DEFAULT 100000,
    "refill" BOOLEAN NOT NULL DEFAULT false,
    "cancel" BOOLEAN NOT NULL DEFAULT false,
    "dripfeed" BOOLEAN NOT NULL DEFAULT false,
    "averageTime" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Service_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("averageTime", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "type") SELECT "averageTime", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "type" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX "Service_panelId_idx" ON "Service"("panelId");
CREATE INDEX "Service_sourceServiceId_idx" ON "Service"("sourceServiceId");
CREATE UNIQUE INDEX "Service_panelId_publicId_key" ON "Service"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
