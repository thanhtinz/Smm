-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Currency" (
    "autoUpdate" BOOLEAN NOT NULL DEFAULT true,
    "rateUpdatedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbolBefore" BOOLEAN NOT NULL DEFAULT true,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "rate" REAL NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Currency" ("code", "decimals", "enabled", "id", "isBase", "name", "position", "rate", "symbol", "symbolBefore", "updatedAt") SELECT "code", "decimals", "enabled", "id", "isBase", "name", "position", "rate", "symbol", "symbolBefore", "updatedAt" FROM "Currency";
DROP TABLE "Currency";
ALTER TABLE "new_Currency" RENAME TO "Currency";
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
