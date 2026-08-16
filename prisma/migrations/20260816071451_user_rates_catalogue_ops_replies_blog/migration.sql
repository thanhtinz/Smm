-- AlterTable
ALTER TABLE "Order" ADD COLUMN "oldPosts" INTEGER;

-- CreateTable
CREATE TABLE "UserServiceRate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserServiceRate_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserServiceRate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserServiceRate_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SavedReply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedReply_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BlogPost" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "coverUrl" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "author" TEXT NOT NULL DEFAULT '',
    "metaTitle" TEXT NOT NULL DEFAULT '',
    "metaDescription" TEXT NOT NULL DEFAULT '',
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BlogPost_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "alias" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_Provider" ("alertPercent", "apiKey", "apiUrl", "autoSync", "balance", "createdAt", "currency", "enabled", "id", "lastSyncAt", "lowBalance", "markupPercent", "name", "panelId", "syncEveryHours") SELECT "alertPercent", "apiKey", "apiUrl", "autoSync", "balance", "createdAt", "currency", "enabled", "id", "lastSyncAt", "lowBalance", "markupPercent", "name", "panelId", "syncEveryHours" FROM "Provider";
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
    "tags" TEXT NOT NULL DEFAULT '',
    "warrantyDays" INTEGER NOT NULL DEFAULT 0,
    "startMinutes" INTEGER NOT NULL DEFAULT 0,
    "speedPerDay" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "increment" INTEGER NOT NULL DEFAULT 0,
    "overflowPercent" REAL NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Service_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Service_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Service_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Service_backupProviderId_fkey" FOREIGN KEY ("backupProviderId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("autoPrice", "averageTime", "backupProviderId", "backupProviderServiceId", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "missingSince", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "speedPerDay", "startMinutes", "tags", "target", "type", "warrantyDays") SELECT "autoPrice", "averageTime", "backupProviderId", "backupProviderServiceId", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "missingSince", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "sourceServiceId", "speedPerDay", "startMinutes", "tags", "target", "type", "warrantyDays" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX "Service_panelId_idx" ON "Service"("panelId");
CREATE INDEX "Service_sourceServiceId_idx" ON "Service"("sourceServiceId");
CREATE UNIQUE INDEX "Service_panelId_publicId_key" ON "Service"("panelId", "publicId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'user',
    "balance" REAL NOT NULL DEFAULT 0,
    "spent" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT '',
    "locale" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT '',
    "colorMode" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT '',
    "direction" TEXT NOT NULL DEFAULT '',
    "apiKey" TEXT NOT NULL,
    "callbackUrl" TEXT NOT NULL DEFAULT '',
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "totpSecret" TEXT NOT NULL DEFAULT '',
    "totpEnabledAt" DATETIME,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT NOT NULL DEFAULT '',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referredById" TEXT,
    "referralCode" TEXT,
    "tierId" TEXT,
    "discountPercent" REAL NOT NULL DEFAULT 0,
    "allowedPaymentMethods" TEXT NOT NULL DEFAULT '[]',
    "accessRules" TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "User_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "UserTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("apiKey", "balance", "banReason", "banned", "callbackUrl", "colorMode", "createdAt", "currency", "direction", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "panelId", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "tierId", "timezone", "totpEnabledAt", "totpSecret", "updatedAt", "username") SELECT "apiKey", "balance", "banReason", "banned", "callbackUrl", "colorMode", "createdAt", "currency", "direction", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "panelId", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "tierId", "timezone", "totpEnabledAt", "totpSecret", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");
CREATE INDEX "User_panelId_idx" ON "User"("panelId");
CREATE UNIQUE INDEX "User_panelId_publicId_key" ON "User"("panelId", "publicId");
CREATE UNIQUE INDEX "User_panelId_username_key" ON "User"("panelId", "username");
CREATE UNIQUE INDEX "User_panelId_email_key" ON "User"("panelId", "email");
CREATE UNIQUE INDEX "User_panelId_referralCode_key" ON "User"("panelId", "referralCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "UserServiceRate_panelId_idx" ON "UserServiceRate"("panelId");

-- CreateIndex
CREATE INDEX "UserServiceRate_serviceId_idx" ON "UserServiceRate"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "UserServiceRate_userId_serviceId_key" ON "UserServiceRate"("userId", "serviceId");

-- CreateIndex
CREATE INDEX "SavedReply_panelId_idx" ON "SavedReply"("panelId");

-- CreateIndex
CREATE INDEX "BlogPost_panelId_publishedAt_idx" ON "BlogPost"("panelId", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlogPost_panelId_slug_key" ON "BlogPost"("panelId", "slug");
