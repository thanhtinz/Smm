-- A service's address is unique under its category, not across the panel:
-- "viet-nam" can exist under several of them. Written by hand rather than
-- generated so scripts/backfill-service-slug.mjs can run between adding the
-- column and adding this index — every existing row shares the empty default
-- until then.
CREATE UNIQUE INDEX "Service_panelId_categoryId_slug_key" ON "Service"("panelId", "categoryId", "slug");
