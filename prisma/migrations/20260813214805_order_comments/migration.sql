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
    "comments" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_Order" ("charge", "createdAt", "id", "interval", "link", "note", "panelId", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "sourceOrderId", "startCount", "status", "updatedAt", "userId") SELECT "charge", "createdAt", "id", "interval", "link", "note", "panelId", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "sourceOrderId", "startCount", "status", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_panelId_idx" ON "Order"("panelId");
CREATE INDEX "Order_sourceOrderId_idx" ON "Order"("sourceOrderId");
CREATE UNIQUE INDEX "Order_panelId_publicId_key" ON "Order"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
