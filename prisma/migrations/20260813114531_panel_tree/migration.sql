-- CreateTable
CREATE TABLE "Panel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "depth" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT NOT NULL DEFAULT '',
    "ownerUserId" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "statusNote" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Panel_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Panel" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PanelDomain" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifyToken" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PanelDomain_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Panel_slug_key" ON "Panel"("slug");

-- CreateIndex
CREATE INDEX "Panel_parentId_idx" ON "Panel"("parentId");

-- CreateIndex
CREATE INDEX "Panel_path_idx" ON "Panel"("path");

-- CreateIndex
CREATE UNIQUE INDEX "PanelDomain_host_key" ON "PanelDomain"("host");

-- CreateIndex
CREATE INDEX "PanelDomain_panelId_idx" ON "PanelDomain"("panelId");
