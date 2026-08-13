import { basePrisma } from "./db-base";
import { currentPanelId } from "./tenancy";

/**
 * Tables that belong to exactly one panel. Everything absent from this set is
 * shared across panels: the panel tree itself, and the reference data every
 * panel picks from (languages, translations, currencies, themes).
 */
const TENANT_MODELS = new Set([
  "Setting",
  "Counter",
  "User",
  "Session",
  "ActivityLog",
  "Media",
  "Platform",
  "Category",
  "Provider",
  "Service",
  "Order",
  "OrderRequest",
  "PaymentMethod",
  "Transaction",
  "Ticket",
  "TicketMessage",
  "Notification",
  "Coupon",
  "CouponRedemption",
  "ReferralEarning",
  "Announcement",
  "Page",
]);

/** Operations whose `where` selects the rows to read or change. */
const FILTERED = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

/**
 * The panel filter.
 *
 * This is the choke point that keeps one panel's queries off another panel's
 * rows, so the pages, actions and route handlers do not each have to remember
 * a filter. Two limits are worth stating plainly, because they are what the
 * tenancy test exists to cover:
 *
 *   - Nested writes (`{ messages: { create: ... } }`) do not pass through
 *     here; those callsites set panelId themselves.
 *   - Relations loaded through `include`/`select` are not filtered either.
 *     They are safe only because a row never references a row in another
 *     panel — an invariant the test asserts across every foreign key rather
 *     than one SQLite can declare.
 */
export const db = basePrisma.$extends({
  name: "panel-scope",
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args);

        const panelId = await currentPanelId();
        const next = args as Record<string, unknown>;

        if (FILTERED.has(operation)) {
          next.where = { ...((next.where as object) ?? {}), panelId };
        } else if (operation === "create") {
          next.data = { ...((next.data as object) ?? {}), panelId };
        } else if (operation === "createMany" || operation === "createManyAndReturn") {
          const data = next.data;
          next.data = Array.isArray(data)
            ? data.map((row) => ({ ...(row as object), panelId }))
            : { ...((data as object) ?? {}), panelId };
        } else if (operation === "upsert") {
          next.where = { ...((next.where as object) ?? {}), panelId };
          next.create = { ...((next.create as object) ?? {}), panelId };
        }

        return query(next);
      },
    },
  },
});
