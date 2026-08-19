-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Platform" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'globe',
    "image" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "hosts" TEXT NOT NULL DEFAULT '',
    "postPattern" TEXT NOT NULL DEFAULT '',
    "profilePattern" TEXT NOT NULL DEFAULT '',
    "postExample" TEXT NOT NULL DEFAULT '',
    "profileExample" TEXT NOT NULL DEFAULT '',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "showServices" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Platform_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Platform" ("color", "hosts", "icon", "id", "image", "name", "panelId", "position", "postExample", "postPattern", "profileExample", "profilePattern", "slug", "visible") SELECT "color", "hosts", "icon", "id", "image", "name", "panelId", "position", "postExample", "postPattern", "profileExample", "profilePattern", "slug", "visible" FROM "Platform";
DROP TABLE "Platform";
ALTER TABLE "new_Platform" RENAME TO "Platform";
CREATE INDEX "Platform_panelId_idx" ON "Platform"("panelId");
CREATE UNIQUE INDEX "Platform_panelId_slug_key" ON "Platform"("panelId", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
