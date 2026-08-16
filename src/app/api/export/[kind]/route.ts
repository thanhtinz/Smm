import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import { csvFilename, csvResponse } from "@/lib/csv";
import { getSetting } from "@/lib/settings";
import { priceServices, resolvePricing } from "@/lib/pricing";

/**
 * Downloads of what the screens already show.
 *
 * Accounting wants transactions in a spreadsheet, a reseller wants the price
 * list, and support wants an order history it can filter without the panel.
 * All three were leaving with screenshots.
 *
 * A customer exports their own rows. An admin may pass ?all=1 to take the
 * panel's, which is the only difference between the two — the filters, the
 * columns and the file are otherwise the same.
 *
 * Admin, not staff. src/app/admin/layout.tsx is the only gate on the admin
 * area and it says so plainly: it lets the support role in and then confines
 * it to /admin/tickets, keeping "settings, providers, payment credentials and
 * the user list with the admin". A route handler is not a page, so that layout
 * never runs here — and this authorised on STAFF_ROLES, which includes
 * support. `GET /api/export/orders?all=1` handed a support account a CSV of
 * every order and every transaction in the panel: the exact list the layout
 * exists to withhold.
 */
const BATCH = 500;

export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in first", { status: 401 });

  const url = new URL(request.url);
  const everyone = url.searchParams.get("all") === "1" && user.role === "admin";

  const ctx = await getAppContext();
  const dates = dateFormats(ctx.locale, ctx.timezone);
  const site = String(await getSetting("site.name"));
  const money = (amount: number) => displayMoney(amount, ctx.currency, ctx.locale);

  if (kind === "orders") {
    const status = url.searchParams.get("status") ?? "";
    const where = {
      ...(everyone ? {} : { userId: user.id }),
      ...(status ? { status } : {}),
    };

    return csvResponse(
      csvFilename("orders", site),
      [
        ctx.t("order.id"),
        ...(everyone ? [ctx.t("auth.username")] : []),
        ctx.t("order.service"),
        ctx.t("order.link"),
        ctx.t("order.quantity"),
        ctx.t("order.startCount"),
        ctx.t("order.remains"),
        ctx.t("order.charge"),
        ctx.t("common.status"),
        ctx.t("common.date"),
        ctx.t("order.finished"),
      ],
      async function* () {
        // Keyset paging rather than skip/take: an export of a busy panel would
        // otherwise miss or repeat rows as new orders arrive mid-download.
        let cursor: string | undefined;
        for (;;) {
          const batch = await db.order.findMany({
            where,
            orderBy: { id: "asc" },
            take: BATCH,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: { service: { select: { name: true } }, user: { select: { username: true } } },
          });
          if (batch.length === 0) return;
          for (const o of batch) {
            yield [
              o.publicId,
              ...(everyone ? [o.user.username] : []),
              o.service.name,
              o.link,
              o.quantity,
              o.startCount,
              o.remains,
              money(o.charge),
              ctx.t(`status.${o.status}`),
              dates.full(o.createdAt),
              o.settledAt ? dates.full(o.settledAt) : "",
            ];
          }
          cursor = batch[batch.length - 1].id;
        }
      },
    );
  }

  if (kind === "transactions") {
    const type = url.searchParams.get("type") ?? "";
    const where = {
      ...(everyone ? {} : { userId: user.id }),
      ...(type ? { type } : {}),
    };

    return csvResponse(
      csvFilename("transactions", site),
      [
        ctx.t("wallet.reference"),
        ...(everyone ? [ctx.t("auth.username")] : []),
        ctx.t("wallet.type"),
        ctx.t("common.amount"),
        ctx.t("common.status"),
        ctx.t("admin.note"),
        ctx.t("common.date"),
      ],
      async function* () {
        let cursor: string | undefined;
        for (;;) {
          const batch = await db.transaction.findMany({
            where,
            orderBy: { id: "asc" },
            take: BATCH,
            ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
            include: { user: { select: { username: true } } },
          });
          if (batch.length === 0) return;
          for (const tx of batch) {
            yield [
              tx.publicId,
              ...(everyone ? [tx.user.username] : []),
              ctx.t(`wallet.${tx.type}`),
              money(tx.amount),
              ctx.t(`status.${tx.status}`),
              tx.note,
              dates.full(tx.createdAt),
            ];
          }
          cursor = batch[batch.length - 1].id;
        }
      },
    );
  }

  if (kind === "services") {
    // Priced for whoever is asking, since that is the price they would pay.
    const rows = await db.service.findMany({
      where: { enabled: true },
      orderBy: [{ position: "asc" }, { publicId: "asc" }],
      include: { category: { select: { name: true, platform: { select: { name: true } } } } },
    });
    const rates = await priceServices(await resolvePricing(user), rows);

    return csvResponse(
      csvFilename("services", site),
      [
        ctx.t("order.id"),
        ctx.t("order.platform"),
        ctx.t("order.category"),
        ctx.t("order.service"),
        ctx.t("admin.rate"),
        ctx.t("order.min"),
        ctx.t("order.max"),
        ctx.t("order.refill"),
        ctx.t("order.cancel"),
        ctx.t("order.dripfeed"),
        ctx.t("order.averageTime"),
      ],
      async function* () {
        const yes = ctx.t("common.yes");
        const no = ctx.t("common.no");
        for (const s of rows) {
          yield [
            s.publicId,
            s.category.platform?.name ?? "",
            s.category.name,
            s.name,
            money(rates.get(s.id) ?? s.rate),
            s.min,
            s.max,
            s.refill ? yes : no,
            s.cancel ? yes : no,
            s.dripfeed ? yes : no,
            s.averageTime,
          ];
        }
      },
    );
  }

  notFound();
}
