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
  "AuthToken",
  "RecoveryCode",
  "ActivityLog",
  "Media",
  "Platform",
  "Category",
  "Provider",
  "Service",
  "ServiceRoute",
  "Order",
  "OrderEvent",
  "Blocklist",
  "Callback",
  "Keyword",
  "KeywordRank",
  "OrderRequest",
  "PanelRequest",
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
  "Testimonial",
  "Faq",
  "Channel",
  "Conversation",
  "InboxMessage",
  "UserTier",
  "TierPrice",
]);

/**
 * Refuses a query that names a different panel than the one in context.
 *
 * Without this the injected panelId would silently win and the query would
 * quietly return the wrong panel's rows — which reads as an empty result or a
 * zero count, not as an error. Reading another panel on purpose is spelled
 * `runAsPanel`, and this is what makes forgetting that loud.
 */
function assertSamePanel(model: string, operation: string, where: unknown, panelId: string) {
  const named = (where as { panelId?: unknown } | undefined)?.panelId;
  if (named === undefined || named === panelId) return;
  throw new Error(
    `${model}.${operation} filtered on a different panel than the one in context. ` +
      `Wrap the call in runAsPanel(panelId, ...) to read another panel deliberately.`,
  );
}

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
 *   - A panelId passed in a `where` is overwritten, not merged, so no caller
 *     can read another panel by asking nicely. Legitimate cross-panel reads —
 *     a parent counting its child's orders — go through `runAsPanel`.
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
          assertSamePanel(model, operation, next.where, panelId);
          next.where = { ...((next.where as object) ?? {}), panelId };
        } else if (operation === "create") {
          next.data = { ...((next.data as object) ?? {}), panelId };
        } else if (operation === "createMany" || operation === "createManyAndReturn") {
          const data = next.data;
          next.data = Array.isArray(data)
            ? data.map((row) => ({ ...(row as object), panelId }))
            : { ...((data as object) ?? {}), panelId };
        } else if (operation === "upsert") {
          assertSamePanel(model, operation, next.where, panelId);
          next.where = { ...((next.where as object) ?? {}), panelId };
          next.create = { ...((next.create as object) ?? {}), panelId };
        }

        return query(next);
      },
    },
  },
});
