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
    "startCount" INTEGER NOT NULL DEFAULT 0,
    "remains" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "providerOrderId" TEXT NOT NULL DEFAULT '',
    "sourceOrderId" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "runs" INTEGER,
    "interval" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("charge", "createdAt", "id", "interval", "link", "note", "panelId", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "startCount", "status", "updatedAt", "userId") SELECT "charge", "createdAt", "id", "interval", "link", "note", "panelId", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "startCount", "status", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_panelId_idx" ON "Order"("panelId");
CREATE INDEX "Order_sourceOrderId_idx" ON "Order"("sourceOrderId");
CREATE UNIQUE INDEX "Order_panelId_publicId_key" ON "Order"("panelId", "publicId");
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
INSERT INTO "new_Service" ("averageTime", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "type") SELECT "averageTime", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "name", "panelId", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "type" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX "Service_panelId_idx" ON "Service"("panelId");
CREATE INDEX "Service_sourceServiceId_idx" ON "Service"("sourceServiceId");
CREATE UNIQUE INDEX "Service_panelId_publicId_key" ON "Service"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
