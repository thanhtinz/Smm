-- A category's address is unique under its platform, not across the panel:
-- two platforms can both have a "follow" without one being renamed.
-- Written by hand rather than generated so the backfill
-- (scripts/backfill-category-slug.mjs) can run between adding the column and
-- adding this index — every existing row shares the empty default until then.
CREATE UNIQUE INDEX "Category_panelId_platformId_slug_key" ON "Category"("panelId", "platformId", "slug");
