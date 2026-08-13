-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_OrderRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "orderId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "providerRequestId" TEXT NOT NULL DEFAULT '',
    "sourceRequestId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderRequest_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderRequest" ("createdAt", "id", "note", "orderId", "panelId", "providerRequestId", "publicId", "status", "type", "updatedAt", "userId") SELECT "createdAt", "id", "note", "orderId", "panelId", "providerRequestId", "publicId", "status", "type", "updatedAt", "userId" FROM "OrderRequest";
DROP TABLE "OrderRequest";
ALTER TABLE "new_OrderRequest" RENAME TO "OrderRequest";
CREATE INDEX "OrderRequest_userId_idx" ON "OrderRequest"("userId");
CREATE INDEX "OrderRequest_orderId_idx" ON "OrderRequest"("orderId");
CREATE INDEX "OrderRequest_status_idx" ON "OrderRequest"("status");
CREATE INDEX "OrderRequest_sourceRequestId_idx" ON "OrderRequest"("sourceRequestId");
CREATE INDEX "OrderRequest_panelId_idx" ON "OrderRequest"("panelId");
CREATE UNIQUE INDEX "OrderRequest_panelId_publicId_key" ON "OrderRequest"("panelId", "publicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
