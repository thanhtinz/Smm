-- Scopes every tenant table to a Panel.
--
-- Existing rows belong to the root panel: this database was the root panel
-- before child panels existed. The subquery yields NULL on an empty database,
-- which is harmless there because the source tables are empty too.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "detail" TEXT NOT NULL DEFAULT '',
    "ip" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ActivityLog" ("panelId", "action", "createdAt", "detail", "id", "ip", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "action", "createdAt", "detail", "id", "ip", "userId" FROM "ActivityLog";
DROP TABLE "ActivityLog";
ALTER TABLE "new_ActivityLog" RENAME TO "ActivityLog";
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");
CREATE INDEX "ActivityLog_panelId_idx" ON "ActivityLog"("panelId");
CREATE TABLE "new_Announcement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Announcement_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Announcement" ("panelId", "body", "createdAt", "enabled", "id", "level", "title") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "body", "createdAt", "enabled", "id", "level", "title" FROM "Announcement";
DROP TABLE "Announcement";
ALTER TABLE "new_Announcement" RENAME TO "Announcement";
CREATE INDEX "Announcement_panelId_idx" ON "Announcement"("panelId");
CREATE TABLE "new_Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "platformId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Category_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Category_platformId_fkey" FOREIGN KEY ("platformId") REFERENCES "Platform" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Category" ("panelId", "description", "id", "name", "platformId", "position", "visible") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "description", "id", "name", "platformId", "position", "visible" FROM "Category";
DROP TABLE "Category";
ALTER TABLE "new_Category" RENAME TO "Category";
CREATE INDEX "Category_platformId_idx" ON "Category"("platformId");
CREATE INDEX "Category_panelId_idx" ON "Category"("panelId");
CREATE TABLE "new_Counter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Counter_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Counter" ("id", "panelId", "name", "value") SELECT lower(hex(randomblob(16))), (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "name", "value" FROM "Counter";
DROP TABLE "Counter";
ALTER TABLE "new_Counter" RENAME TO "Counter";
CREATE UNIQUE INDEX "Counter_panelId_name_key" ON "Counter"("panelId", "name");
CREATE TABLE "new_Coupon" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'percent',
    "value" REAL NOT NULL DEFAULT 0,
    "minAmount" REAL NOT NULL DEFAULT 0,
    "maxUses" INTEGER NOT NULL DEFAULT 0,
    "maxPerUser" INTEGER NOT NULL DEFAULT 1,
    "firstDepositOnly" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" DATETIME,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Coupon_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Coupon" ("panelId", "code", "createdAt", "enabled", "expiresAt", "firstDepositOnly", "id", "maxPerUser", "maxUses", "minAmount", "type", "value") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "code", "createdAt", "enabled", "expiresAt", "firstDepositOnly", "id", "maxPerUser", "maxUses", "minAmount", "type", "value" FROM "Coupon";
DROP TABLE "Coupon";
ALTER TABLE "new_Coupon" RENAME TO "Coupon";
CREATE INDEX "Coupon_panelId_idx" ON "Coupon"("panelId");
CREATE UNIQUE INDEX "Coupon_panelId_code_key" ON "Coupon"("panelId", "code");
CREATE TABLE "new_CouponRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "couponId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "bonus" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CouponRedemption_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponRedemption_couponId_fkey" FOREIGN KEY ("couponId") REFERENCES "Coupon" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CouponRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CouponRedemption" ("panelId", "bonus", "couponId", "createdAt", "id", "transactionId", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "bonus", "couponId", "createdAt", "id", "transactionId", "userId" FROM "CouponRedemption";
DROP TABLE "CouponRedemption";
ALTER TABLE "new_CouponRedemption" RENAME TO "CouponRedemption";
CREATE UNIQUE INDEX "CouponRedemption_transactionId_key" ON "CouponRedemption"("transactionId");
CREATE INDEX "CouponRedemption_couponId_idx" ON "CouponRedemption"("couponId");
CREATE INDEX "CouponRedemption_userId_idx" ON "CouponRedemption"("userId");
CREATE INDEX "CouponRedemption_panelId_idx" ON "CouponRedemption"("panelId");
CREATE TABLE "new_Media" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 0,
    "height" INTEGER NOT NULL DEFAULT 0,
    "data" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Media_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Media" ("panelId", "createdAt", "data", "height", "id", "mime", "size", "width") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "createdAt", "data", "height", "id", "mime", "size", "width" FROM "Media";
DROP TABLE "Media";
ALTER TABLE "new_Media" RENAME TO "Media";
CREATE INDEX "Media_panelId_idx" ON "Media"("panelId");
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "href" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Notification" ("panelId", "body", "createdAt", "href", "id", "level", "read", "title", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "body", "createdAt", "href", "id", "level", "read", "title", "userId" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX "Notification_panelId_idx" ON "Notification"("panelId");
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
    "note" TEXT NOT NULL DEFAULT '',
    "runs" INTEGER,
    "interval" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("panelId", "charge", "createdAt", "id", "interval", "link", "note", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "startCount", "status", "updatedAt", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "charge", "createdAt", "id", "interval", "link", "note", "providerOrderId", "publicId", "quantity", "remains", "runs", "serviceId", "startCount", "status", "updatedAt", "userId" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE INDEX "Order_userId_idx" ON "Order"("userId");
CREATE INDEX "Order_status_idx" ON "Order"("status");
CREATE INDEX "Order_panelId_idx" ON "Order"("panelId");
CREATE UNIQUE INDEX "Order_panelId_publicId_key" ON "Order"("panelId", "publicId");
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderRequest_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_OrderRequest" ("panelId", "createdAt", "id", "note", "orderId", "providerRequestId", "publicId", "status", "type", "updatedAt", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "createdAt", "id", "note", "orderId", "providerRequestId", "publicId", "status", "type", "updatedAt", "userId" FROM "OrderRequest";
DROP TABLE "OrderRequest";
ALTER TABLE "new_OrderRequest" RENAME TO "OrderRequest";
CREATE INDEX "OrderRequest_userId_idx" ON "OrderRequest"("userId");
CREATE INDEX "OrderRequest_orderId_idx" ON "OrderRequest"("orderId");
CREATE INDEX "OrderRequest_status_idx" ON "OrderRequest"("status");
CREATE INDEX "OrderRequest_panelId_idx" ON "OrderRequest"("panelId");
CREATE UNIQUE INDEX "OrderRequest_panelId_publicId_key" ON "OrderRequest"("panelId", "publicId");
CREATE TABLE "new_Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "showInFooter" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Page_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Page" ("panelId", "body", "id", "position", "published", "showInFooter", "slug", "title", "updatedAt") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "body", "id", "position", "published", "showInFooter", "slug", "title", "updatedAt" FROM "Page";
DROP TABLE "Page";
ALTER TABLE "new_Page" RENAME TO "Page";
CREATE INDEX "Page_panelId_idx" ON "Page"("panelId");
CREATE UNIQUE INDEX "Page_panelId_slug_key" ON "Page"("panelId", "slug");
CREATE TABLE "new_PaymentMethod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "icon" TEXT NOT NULL DEFAULT 'wallet',
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
INSERT INTO "new_PaymentMethod" ("panelId", "bonusPercent", "code", "config", "currencies", "description", "driver", "enabled", "feeFixed", "feePercent", "icon", "id", "maxAmount", "minAmount", "name", "position") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "bonusPercent", "code", "config", "currencies", "description", "driver", "enabled", "feeFixed", "feePercent", "icon", "id", "maxAmount", "minAmount", "name", "position" FROM "PaymentMethod";
DROP TABLE "PaymentMethod";
ALTER TABLE "new_PaymentMethod" RENAME TO "PaymentMethod";
CREATE INDEX "PaymentMethod_panelId_idx" ON "PaymentMethod"("panelId");
CREATE UNIQUE INDEX "PaymentMethod_panelId_code_key" ON "PaymentMethod"("panelId", "code");
CREATE TABLE "new_Platform" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'globe',
    "image" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Platform_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Platform" ("panelId", "color", "icon", "id", "image", "name", "position", "slug", "visible") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "color", "icon", "id", "image", "name", "position", "slug", "visible" FROM "Platform";
DROP TABLE "Platform";
ALTER TABLE "new_Platform" RENAME TO "Platform";
CREATE INDEX "Platform_panelId_idx" ON "Platform"("panelId");
CREATE UNIQUE INDEX "Platform_panelId_slug_key" ON "Platform"("panelId", "slug");
CREATE TABLE "new_Provider" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "name" TEXT NOT NULL,
    "apiUrl" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "balance" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "lastSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Provider_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Provider" ("panelId", "apiKey", "apiUrl", "balance", "createdAt", "currency", "enabled", "id", "lastSyncAt", "name") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "apiKey", "apiUrl", "balance", "createdAt", "currency", "enabled", "id", "lastSyncAt", "name" FROM "Provider";
DROP TABLE "Provider";
ALTER TABLE "new_Provider" RENAME TO "Provider";
CREATE INDEX "Provider_panelId_idx" ON "Provider"("panelId");
CREATE TABLE "new_ReferralEarning" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "referrerId" TEXT NOT NULL,
    "referredId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "ratePercent" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'earned',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralEarning_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferralEarning_referrerId_fkey" FOREIGN KEY ("referrerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReferralEarning_referredId_fkey" FOREIGN KEY ("referredId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ReferralEarning" ("panelId", "amount", "createdAt", "id", "ratePercent", "referredId", "referrerId", "status", "transactionId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "amount", "createdAt", "id", "ratePercent", "referredId", "referrerId", "status", "transactionId" FROM "ReferralEarning";
DROP TABLE "ReferralEarning";
ALTER TABLE "new_ReferralEarning" RENAME TO "ReferralEarning";
CREATE UNIQUE INDEX "ReferralEarning_transactionId_key" ON "ReferralEarning"("transactionId");
CREATE INDEX "ReferralEarning_referrerId_idx" ON "ReferralEarning"("referrerId");
CREATE INDEX "ReferralEarning_panelId_idx" ON "ReferralEarning"("panelId");
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "providerId" TEXT,
    "providerServiceId" TEXT NOT NULL DEFAULT '',
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
INSERT INTO "new_Service" ("panelId", "averageTime", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "name", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "type") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "averageTime", "cancel", "categoryId", "createdAt", "description", "dripfeed", "enabled", "id", "max", "min", "name", "position", "providerId", "providerRate", "providerServiceId", "publicId", "rate", "refill", "type" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
CREATE INDEX "Service_categoryId_idx" ON "Service"("categoryId");
CREATE INDEX "Service_panelId_idx" ON "Service"("panelId");
CREATE UNIQUE INDEX "Service_panelId_publicId_key" ON "Service"("panelId", "publicId");
CREATE TABLE "new_Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ip" TEXT NOT NULL DEFAULT '',
    "userAgent" TEXT NOT NULL DEFAULT '',
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Session" ("panelId", "createdAt", "expiresAt", "id", "ip", "token", "userAgent", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "createdAt", "expiresAt", "id", "ip", "token", "userAgent", "userId" FROM "Session";
DROP TABLE "Session";
ALTER TABLE "new_Session" RENAME TO "Session";
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_panelId_idx" ON "Session"("panelId");
CREATE TABLE "new_Setting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "group" TEXT NOT NULL DEFAULT 'general',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Setting_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Setting" ("id", "panelId", "group", "key", "updatedAt", "value") SELECT lower(hex(randomblob(16))), (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "group", "key", "updatedAt", "value" FROM "Setting";
DROP TABLE "Setting";
ALTER TABLE "new_Setting" RENAME TO "Setting";
CREATE INDEX "Setting_panelId_idx" ON "Setting"("panelId");
CREATE UNIQUE INDEX "Setting_panelId_key_key" ON "Setting"("panelId", "key");
CREATE TABLE "new_Ticket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ticket_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Ticket" ("panelId", "category", "createdAt", "id", "publicId", "status", "subject", "updatedAt", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "category", "createdAt", "id", "publicId", "status", "subject", "updatedAt", "userId" FROM "Ticket";
DROP TABLE "Ticket";
ALTER TABLE "new_Ticket" RENAME TO "Ticket";
CREATE INDEX "Ticket_userId_idx" ON "Ticket"("userId");
CREATE INDEX "Ticket_panelId_idx" ON "Ticket"("panelId");
CREATE UNIQUE INDEX "Ticket_panelId_publicId_key" ON "Ticket"("panelId", "publicId");
CREATE TABLE "new_TicketMessage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "ticketId" TEXT NOT NULL,
    "authorId" TEXT,
    "fromStaff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_TicketMessage" ("panelId", "authorId", "body", "createdAt", "fromStaff", "id", "ticketId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "authorId", "body", "createdAt", "fromStaff", "id", "ticketId" FROM "TicketMessage";
DROP TABLE "TicketMessage";
ALTER TABLE "new_TicketMessage" RENAME TO "TicketMessage";
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");
CREATE INDEX "TicketMessage_panelId_idx" ON "TicketMessage"("panelId");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "methodId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'deposit',
    "amount" REAL NOT NULL,
    "paidAmount" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "fee" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reference" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "meta" TEXT NOT NULL DEFAULT '{}',
    "balanceAfter" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Transaction_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Transaction_methodId_fkey" FOREIGN KEY ("methodId") REFERENCES "PaymentMethod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("panelId", "amount", "balanceAfter", "createdAt", "currency", "fee", "id", "meta", "methodId", "note", "paidAmount", "publicId", "reference", "status", "type", "updatedAt", "userId") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "amount", "balanceAfter", "createdAt", "currency", "fee", "id", "meta", "methodId", "note", "paidAmount", "publicId", "reference", "status", "type", "updatedAt", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE INDEX "Transaction_userId_idx" ON "Transaction"("userId");
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");
CREATE INDEX "Transaction_panelId_idx" ON "Transaction"("panelId");
CREATE UNIQUE INDEX "Transaction_panelId_publicId_key" ON "Transaction"("panelId", "publicId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "panelId" TEXT NOT NULL DEFAULT '',
    "publicId" INTEGER NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'user',
    "balance" REAL NOT NULL DEFAULT 0,
    "spent" REAL NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "locale" TEXT NOT NULL DEFAULT 'vi',
    "theme" TEXT NOT NULL DEFAULT 'aurora',
    "colorMode" TEXT NOT NULL DEFAULT 'dark',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
    "apiKey" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "banned" BOOLEAN NOT NULL DEFAULT false,
    "banReason" TEXT NOT NULL DEFAULT '',
    "lastLoginAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "referredById" TEXT,
    "referralCode" TEXT,
    CONSTRAINT "User_panelId_fkey" FOREIGN KEY ("panelId") REFERENCES "Panel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("panelId", "apiKey", "balance", "banReason", "banned", "colorMode", "createdAt", "currency", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "timezone", "updatedAt", "username") SELECT (SELECT "id" FROM "Panel" WHERE "parentId" IS NULL ORDER BY "createdAt" ASC LIMIT 1), "apiKey", "balance", "banReason", "banned", "colorMode", "createdAt", "currency", "email", "emailVerified", "fullName", "id", "lastLoginAt", "locale", "password", "publicId", "referralCode", "referredById", "role", "spent", "theme", "timezone", "updatedAt", "username" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_apiKey_key" ON "User"("apiKey");
CREATE INDEX "User_panelId_idx" ON "User"("panelId");
CREATE UNIQUE INDEX "User_panelId_publicId_key" ON "User"("panelId", "publicId");
CREATE UNIQUE INDEX "User_panelId_username_key" ON "User"("panelId", "username");
CREATE UNIQUE INDEX "User_panelId_email_key" ON "User"("panelId", "email");
CREATE UNIQUE INDEX "User_panelId_referralCode_key" ON "User"("panelId", "referralCode");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

