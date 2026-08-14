-- Orders that had already finished before this column existed. updatedAt is
-- the best estimate available for them, and is marked as such by being the
-- only place it is used this way.
UPDATE "Order"
SET "settledAt" = "updatedAt"
WHERE "settledAt" IS NULL
  AND "status" IN ('completed', 'partial', 'canceled', 'refunded');
