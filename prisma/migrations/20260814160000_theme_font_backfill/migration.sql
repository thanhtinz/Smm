-- The panel declared Inter but never loaded it, so every skin has been
-- rendering in whatever the machine had. The root layout now loads Be Vietnam
-- Pro through next/font; skins still pointing at the old stack are moved onto
-- it. A skin an operator has since edited keeps whatever they chose.
UPDATE "Theme"
SET "tokens" = json_set(
  "tokens",
  '$.font',
  'var(--font-be-vietnam), ''Segoe UI'', system-ui, -apple-system, sans-serif'
)
WHERE json_extract("tokens", '$.font') LIKE '%Inter%';
