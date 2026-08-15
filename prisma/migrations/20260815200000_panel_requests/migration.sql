-- CreateTable
CREATE TABLE "PanelRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL DEFAULT '',
    "nameServers" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "note" TEXT NOT NULL DEFAULT '',
    "createdPanelId" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PanelRequest_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PanelRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PanelRequest_panelId_status_idx" ON "PanelRequest"("panelId", "status");

-- CreateIndex
CREATE INDEX "PanelRequest_userId_idx" ON "PanelRequest"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelRequest_panelId_publicId_key" ON "PanelRequest"("panelId", "publicId");

-- CreateIndex
CREATE UNIQUE INDEX "PanelRequest_panelId_host_key" ON "PanelRequest"("panelId", "host");
