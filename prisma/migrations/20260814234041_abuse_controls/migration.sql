-- CreateTable
CREATE TABLE "Blocklist" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Blocklist_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "link" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "charge" REAL NOT NULL,
    "cost" REAL,
    "startCount" INTEGER NOT NULL DEFAULT 0,
    "remains" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "holdReason" TEXT NOT NULL DEFAULT '',
    "providerOrderId" TEXT NOT NULL DEFAULT '',
    "providerId" TEXT,
    "comments" TEXT NOT NULL DEFAULT '',
    "sourceOrderId" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "runs" INTEGER,
    "interval" INTEGER,
    "posts" INTEGER,
    "minPerPost" INTEGER,
    "maxPerPost" INTEGER,
    "delay" INTEGER,
    "expiry" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "settledAt" DATETIME,
    CONSTRAINT "Order_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "Provider" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("charge", "comments", "cost", "createdAt", "delay", "expiry", "id", "interval", "link", "maxPerPost", "minPerPost", "note", "panelId", "posts", "providerId", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "settledAt", "sourceOrderId", "startCount", "status", "updatedAt", "userId") SELECT "charge", "comments", "cost", "createdAt", "delay", "expiry", "id", "interval", "link", "maxPerPost", "minPerPost", "note", "panelId", "posts", "providerId", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "settledAt", "sourceOrderId", "startCount", "status", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_panelId_idx" ON "Order"("panelId");
CREATE INDEX "Order_sourceOrderId_idx" ON "Order"("sourceOrderId");
CREATE UNIQUE INDEX "Order_panelId_publicId_key" ON "Order"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Blocklist_panelId_idx" ON "Blocklist"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "Blocklist_panelId_kind_value_key" ON "Blocklist"("panelId", "kind", "value");
