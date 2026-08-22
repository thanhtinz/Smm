-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT NOT NULL DEFAULT 'wallet',
    "image" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "config" TEXT NOT NULL DEFAULT '{}',
    "currencies" TEXT NOT NULL DEFAULT '[]',
    "minAmount" REAL NOT NULL DEFAULT 0,
    "maxAmount" REAL NOT NULL DEFAULT 0,
    "feePercent" REAL NOT NULL DEFAULT 0,
    "feeFixed" REAL NOT NULL DEFAULT 0,
    "bonusPercent" REAL NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "PaymentMethod_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_PaymentMethod" ("bonusPercent", "code", "config", "currencies", "description", "driver", "enabled", "feeFixed", "feePercent", "icon", "id", "maxAmount", "minAmount", "name", "panelId", "position") SELECT "bonusPercent", "code", "config", "currencies", "description", "driver", "enabled", "feeFixed", "feePercent", "icon", "id", "maxAmount", "minAmount", "name", "panelId", "position" FROM "PaymentMethod";
DROP TABLE "PaymentMethod";
ALTER TABLE "new_PaymentMethod" RENAME TO "PaymentMethod";
CREATE INDEX "PaymentMethod_panelId_idx" ON "PaymentMethod"("panelId");
CREATE UNIQUE INDEX "PaymentMethod_panelId_code_key" ON "PaymentMethod"("panelId", "code");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
