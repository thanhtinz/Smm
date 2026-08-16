-- The registry's defaults moved: locale.default vi -> en, locale.timezone
-- Asia/Ho_Chi_Minh -> UTC, currency.base and currency.display VND -> USD, and
-- with the base, the three amounts denominated in it.
--
-- A setting only has a row once somebody has changed it, so a panel that
-- never touched these would silently inherit the new ones. For three of them
-- that is a cosmetic surprise. For currency.base it is not: every stored
-- amount in the panel — a balance, a price, a refund, a payout — is a number
-- in the base currency and nothing else records which one. Reinterpreting a
-- 2,500,000 dong balance as 2,500,000 dollars is not a display change.
--
-- So every panel that exists at this point keeps what it had, written out as
-- an explicit row. Only installs created after this migration get the new
-- defaults. Changing the base afterwards is then a deliberate act in
-- Admin -> Localisation, where the operator knows their own numbers.
INSERT INTO "Setting" ("id", "panelId", "key", "value", "group", "updatedAt")
SELECT
  lower(hex(randomblob(12))) || p."id" || d."key",
  p."id",
  d."key",
  d."value",
  d."grp",
  CURRENT_TIMESTAMP
FROM "Panel" p
CROSS JOIN (
  SELECT 'locale.default' AS "key", '"vi"' AS "value", 'locale' AS "grp"
  UNION ALL SELECT 'locale.timezone', '"Asia/Ho_Chi_Minh"', 'locale'
  UNION ALL SELECT 'currency.base', '"VND"', 'locale'
  UNION ALL SELECT 'currency.display', '"VND"', 'locale'
  UNION ALL SELECT 'wallet.minDeposit', '20000', 'wallet'
  UNION ALL SELECT 'wallet.maxDeposit', '500000000', 'wallet'
  UNION ALL SELECT 'affiliate.minWithdraw', '50000', 'affiliate'
) d
WHERE NOT EXISTS (
  SELECT 1 FROM "Setting" s WHERE s."panelId" = p."id" AND s."key" = d."key"
);
