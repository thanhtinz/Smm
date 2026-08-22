-- CreateTable
CREATE TABLE "OAuthAccount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthAccount_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OAuthAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "OAuthAccount_userId_idx" ON "OAuthAccount"("userId");

-- CreateIndex
CREATE INDEX "OAuthAccount_panelId_idx" ON "OAuthAccount"("panelId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_panelId_provider_providerAccountId_key" ON "OAuthAccount"("panelId", "provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "OAuthAccount_panelId_provider_userId_key" ON "OAuthAccount"("panelId", "provider", "userId");
