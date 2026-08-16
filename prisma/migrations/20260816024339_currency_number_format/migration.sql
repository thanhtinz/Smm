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
    "numberFormat" TEXT NOT NULL DEFAULT 'comma-dot',
    "rate" REAL NOT NULL DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Currency" ("autoUpdate", "code", "decimals", "enabled", "id", "isBase", "name", "position", "rate", "rateUpdatedAt", "symbol", "symbolBefore", "updatedAt") SELECT "autoUpdate", "code", "decimals", "enabled", "id", "isBase", "name", "position", "rate", "rateUpdatedAt", "symbol", "symbolBefore", "updatedAt" FROM "Currency";
DROP TABLE "Currency";
ALTER TABLE "new_Currency" RENAME TO "Currency";
CREATE UNIQUE INDEX "Currency_code_key" ON "Currency"("code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- Existing rows all take the column default, which is right for the dollar
-- and wrong for the dong. Punctuation is a property of the currency, so the
-- currencies that ship with the panel get theirs set rather than inheriting
-- somebody else's. Anything an operator added by hand keeps the default and
-- is one dropdown away in Admin -> Currency.
UPDATE "Currency" SET "numberFormat" = 'dot-comma'
  WHERE "code" IN ('VND', 'EUR', 'IDR', 'BRL', 'TRY');
UPDATE "Currency" SET "numberFormat" = 'space-comma'
  WHERE "code" IN ('RUB');
UPDATE "Currency" SET "numberFormat" = 'indian'
  WHERE "code" IN ('INR', 'PKR', 'BDT');
