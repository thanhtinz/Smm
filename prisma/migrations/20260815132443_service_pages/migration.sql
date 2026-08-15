-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "platformId" TEXT,
    "slug" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "seoBody" TEXT NOT NULL DEFAULT '',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Category_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Category_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("description", "id", "name", "panelId", "platformId", "position", "slug", "visible") SELECT "description", "id", "name", "panelId", "platformId", "position", "slug", "visible" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_platformId_idx" ON "Category"("platformId");
CREATE INDEX "Category_panelId_idx" ON "Category"("panelId");
CREATE UNIQUE INDEX "Category_panelId_platformId_slug_key" ON "Category"("panelId", "platformId", "slug");
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
    "warrantyDays" INTEGER NOT NULL DEFAULT 0,
    "startMinutes" INTEGER NOT NULL DEFAULT 0,
    "speedPerDay" INTEGER NOT NULL DEFAULT 0,
    "slug" TEXT NOT NULL DEFAULT '',
    "seoTitle" TEXT NOT NULL DEFAULT '',
    "seoDescription" TEXT NOT NULL DEFAULT '',
    "seoBody" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Service_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Service_backupProviderId_fkey" FOREIGN KEY ("backupProviderId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("autoPrice", "averageTime", "backupProviderId", "backupProviderServiceId", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "missingSince", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "speedPerDay", "startMinutes", "target", "type", "warrantyDays") SELECT "autoPrice", "averageTime", "backupProviderId", "backupProviderServiceId", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "missingSince", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "speedPerDay", "startMinutes", "target", "type", "warrantyDays" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX "Service_panelId_idx" ON "Service"("panelId");
CREATE INDEX "Service_sourceServiceId_idx" ON "Service"("sourceServiceId");
CREATE UNIQUE INDEX "Service_panelId_publicId_key" ON "Service"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
