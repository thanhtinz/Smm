-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Platform" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'globe',
    "image" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "hosts" TEXT NOT NULL DEFAULT '',
    "postPattern" TEXT NOT NULL DEFAULT '',
    "profilePattern" TEXT NOT NULL DEFAULT '',
    "postExample" TEXT NOT NULL DEFAULT '',
    "profileExample" TEXT NOT NULL DEFAULT '',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Platform_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Platform" ("color", "icon", "id", "image", "name", "panelId", "position", "slug", "visible") SELECT "color", "icon", "id", "image", "name", "panelId", "position", "slug", "visible" FROM "Platform";
DROP TABLE "Platform";
ALTER TABLE "new_Platform" RENAME TO "Platform";
CREATE INDEX "Platform_panelId_idx" ON "Platform"("panelId");
CREATE UNIQUE INDEX "Platform_panelId_slug_key" ON "Platform"("panelId", "slug");
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerServiceId" TEXT NOT NULL DEFAULT '',
    "backupProviderId" TEXT,
    "backupProviderServiceId" TEXT NOT NULL DEFAULT '',
    "sourceServiceId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'default',
    "target" TEXT NOT NULL DEFAULT 'post',
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
    CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Service_backupProviderId_fkey" FOREIGN KEY ("backupProviderId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("autoPrice", "averageTime", "backupProviderId", "backupProviderServiceId", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "missingSince", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "type") SELECT "autoPrice", "averageTime", "backupProviderId", "backupProviderServiceId", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "missingSince", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "type" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX "Service_panelId_idx" ON "Service"("panelId");
CREATE INDEX "Service_sourceServiceId_idx" ON "Service"("sourceServiceId");
CREATE UNIQUE INDEX "Service_panelId_publicId_key" ON "Service"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
