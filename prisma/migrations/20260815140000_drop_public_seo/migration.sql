-- The public catalogue is gone: /services and everything under it. These
-- columns only ever filled those pages — a title, a description and a body
-- for an address nobody can open — and the admin fields that wrote them have
-- been removed with the pages.
--
-- Category.slug stays: the panel routes by it at /dashboard/order/<platform>/<category>.
DROP INDEX IF EXISTS "Service_panelId_categoryId_slug_key";

ALTER TABLE "Platform" DROP COLUMN "seoTitle";
ALTER TABLE "Platform" DROP COLUMN "seoDescription";
ALTER TABLE "Platform" DROP COLUMN "seoBody";

ALTER TABLE "Category" DROP COLUMN "seoTitle";
ALTER TABLE "Category" DROP COLUMN "seoDescription";
ALTER TABLE "Category" DROP COLUMN "seoBody";

ALTER TABLE "Service" DROP COLUMN "slug";
ALTER TABLE "Service" DROP COLUMN "seoTitle";
ALTER TABLE "Service" DROP COLUMN "seoDescription";
ALTER TABLE "Service" DROP COLUMN "seoBody";
