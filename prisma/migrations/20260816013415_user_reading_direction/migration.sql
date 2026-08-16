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
    CONSTRAINT "User_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "User_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "UserTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("apiKey", "balance", "banReason", "banned", "callbackUrl", "colorMode", "createdAt", "currency", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "panelId", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "tierId", "timezone", "totpEnabledAt", "totpSecret", "updatedAt", "username") SELECT "apiKey", "balance", "banReason", "banned", "callbackUrl", "colorMode", "createdAt", "currency", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "panelId", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "tierId", "timezone", "totpEnabledAt", "totpSecret", "updatedAt", "username" FROM "User";
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
