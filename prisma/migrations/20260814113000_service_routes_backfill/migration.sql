-- Existing services keep behaving exactly as before: their first choice and
-- their backup become their first two routes. Dispatch then has one list to
-- read, and nothing has moved provider on the day this ships.

-- The first choice, carrying the cost the catalogue sync already knew.
INSERT INTO "ServiceRoute" ("id", "panelId", "serviceId", "providerId", "providerServiceId", "cost", "enabled", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), s."panelId", s."id", s."providerId", s."providerServiceId", s."providerRate", 1,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Service" s
WHERE s."providerId" IS NOT NULL AND s."providerServiceId" <> '';

-- The backup, where one is named and it is a different provider. Its cost is
-- unknown until the next sync, and an unknown cost sorts last.
INSERT INTO "ServiceRoute" ("id", "panelId", "serviceId", "providerId", "providerServiceId", "cost", "enabled", "createdAt", "updatedAt")
SELECT lower(hex(randomblob(12))), s."panelId", s."id", s."backupProviderId", s."backupProviderServiceId", 0, 1,
       CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Service" s
WHERE s."backupProviderId" IS NOT NULL
  AND s."backupProviderServiceId" <> ''
  AND s."backupProviderId" <> COALESCE(s."providerId", '');
