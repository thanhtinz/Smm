-- CreateTable
CREATE TABLE "UserTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "discountPercent" REAL NOT NULL DEFAULT 0,
    "minSpent" REAL NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserTier_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TierPrice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "tierId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "rate" REAL NOT NULL,
    CONSTRAINT "TierPrice_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TierPrice_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "UserTier" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TierPrice_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "theme" TEXT NOT NULL DEFAULT 'aurora',
    "colorMode" TEXT NOT NULL DEFAULT 'dark',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "apiKey" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT NOT NULL DEFAULT '',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referredById" TEXT,
    "referralCode" TEXT,
    "tierId" TEXT,
    CONSTRAINT "User_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "UserTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("apiKey", "balance", "banReason", "banned", "colorMode", "createdAt", "currency", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "panelId", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "timezone", "updatedAt", "username") SELECT "apiKey", "balance", "banReason", "banned", "colorMode", "createdAt", "currency", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "panelId", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "timezone", "updatedAt", "username" FROM "User";
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
CREATE INDEX "UserTier_panelId_idx" ON "UserTier"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTier_panelId_slug_key" ON "UserTier"("panelId", "slug");

-- CreateIndex
CREATE INDEX "TierPrice_panelId_idx" ON "TierPrice"("panelId");

-- CreateIndex
CREATE INDEX "TierPrice_serviceId_idx" ON "TierPrice"("serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "TierPrice_tierId_serviceId_key" ON "TierPrice"("tierId", "serviceId");
