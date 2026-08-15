-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "platformId" TEXT,
    "slug" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Category_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Category_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("description", "id", "name", "panelId", "platformId", "position", "visible") SELECT "description", "id", "name", "panelId", "platformId", "position", "visible" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_platformId_idx" ON "Category"("platformId");
CREATE INDEX "Category_panelId_idx" ON "Category"("panelId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
