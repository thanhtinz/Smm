-- The base currency is read from the root panel now, for every panel in the
-- deployment. It has to be: `Currency` is one global table, and the wholesale
-- chain moves bare numbers between panels — a child charges its customer and
-- the parent charges the child's owner, in `Order.charge` columns that record
-- no unit anywhere. Two panels in one tree disagreeing about what those
-- numbers mean is dollars silently added to dong.
--
-- 20260816120000_pin_locale_defaults wrote a `currency.base` row for every
-- panel that existed, to stop a default change reinterpreting stored money.
-- That was right at the time and is now inert for children: nothing reads
-- them. Deleting them so the table stops asserting something the code does
-- not honour — a stale row that looks authoritative is worse than none.
--
-- The root's row is kept, and it is the one that counts. `currency.display`
-- is untouched: which currency a panel *shows* by default is genuinely its
-- own choice, unlike the unit its numbers are stored in.
DELETE FROM "Setting"
WHERE "key" = 'currency.base'
  AND "panelId" IN (SELECT "id" FROM "Panel" WHERE "parentId" IS NOT NULL);
