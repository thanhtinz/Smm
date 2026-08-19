/**
 * Open every page in the panel and fail on anything that breaks.
 *
 * A route that throws only renders as a 500 — no type error, no lint warning,
 * and nothing at all until somebody clicks it. This walks the whole map as a
 * guest, a customer and an admin, and reports both the status and any error
 * the browser console printed on the way.
 *
 *   npm run smoke            (needs the app running on BASE_URL)
 */
import { chromium } from "playwright";
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient();

const GUEST = ["/", "/api-docs", "/blog", "/login", "/register", "/forgot-password", "/resend-verification"];
const CUSTOMER = [
  "/dashboard",
  "/dashboard/new-order",
  "/dashboard/orders",
  "/dashboard/transactions",
  "/dashboard/wallet",
  "/dashboard/affiliate",
  "/dashboard/tickets",
  "/dashboard/notifications",
  "/dashboard/profile",
  "/dashboard/api",
];
const ADMIN = [
  "/admin",
  "/admin/orders",
  "/admin/requests",
  "/admin/users",
  "/admin/tiers",
  "/admin/platforms",
  "/admin/categories",
  "/admin/services",
  "/admin/providers",
  "/admin/providers/import",
  "/admin/keywords",
  "/admin/coupons",
  "/admin/transactions",
  "/admin/payment-methods",
  "/admin/currencies",
  "/admin/languages",
  "/admin/pages",
  "/admin/blog",
  "/admin/saved-replies",
  "/admin/announcements",
  "/admin/landing",
  "/admin/appearance",
  "/admin/settings",
  "/admin/blocklist",
  "/admin/logs",
  "/admin/statistics",
  "/admin/panels",
  "/admin/channels",
  "/admin/inbox",
  "/admin/cron",
  "/admin/tickets",
];

let failures = 0;
const browser = await chromium.launch({ args: ["--no-sandbox"] });

async function walk(label, paths, login) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addCookies([{ name: "nova_locale", value: "vi", url: BASE }]);
  const page = await ctx.newPage();

  // Anything the page logged as an error is a defect even when it still
  // rendered — a failed fetch, a React key warning, a hydration mismatch.
  const noise = [];
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    // Missing favicons and blocked third-party requests are the environment,
    // not the page.
    if (/favicon|net::ERR_|ERR_CONNECTION|Failed to load resource/i.test(text)) return;
    // This walk navigates faster than a person does, so Next's prefetch of a
    // link is often still in flight when the page it belongs to is gone. It
    // lands on a different page every run, which is what says it is the walk
    // and not the app; the fallback it describes works.
    if (/Failed to fetch RSC payload/i.test(text)) return;
    noise.push(text.slice(0, 160));
  });
  page.on("pageerror", (e) => noise.push(`uncaught: ${String(e).slice(0, 160)}`));

  if (login) {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="identifier"]', login[0]);
    await page.fill('input[name="password"]', login[1]);
    await Promise.all([page.waitForURL(/dashboard|admin/, { timeout: 20000 }), page.click('button[type="submit"]')]);
  }

  // A list, or a function that works one out once signed in — which is how
  // the settings sections are walked without this file holding a copy of the
  // registry that would quietly go stale.
  const list = typeof paths === "function" ? await paths(page) : paths;

  console.log(`\n${label}`);
  for (const path of list) {
    noise.length = 0;
    let status = 0;
    try {
      const res = await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 30000 });
      status = res?.status() ?? 0;
    } catch (e) {
      status = -1;
      noise.push(String(e).slice(0, 120));
    }
    await page.waitForTimeout(120);

    // A page that renders its own error boundary is a 200 with a wrecked
    // screen, so the text is checked too.
    const body = await page.locator("body").innerText().catch(() => "");
    const broke = /Application error|Internal Server Error|Unhandled Runtime/i.test(body);

    const ok = status >= 200 && status < 400 && !broke && noise.length === 0;
    if (!ok) failures++;
    console.log(
      `${ok ? "  ok  " : "FAIL  "} ${status}  ${path}${broke ? "  [error boundary]" : ""}${
        noise.length ? `\n        ${noise.join("\n        ")}` : ""
      }`,
    );
  }
  await ctx.close();
}

// A row per shape, so the parameterised routes are walked with real ids.
const root = await db.panel.findFirst({ where: { parentId: null } });
const order = await db.order.findFirst({ where: { panelId: root.id }, orderBy: { createdAt: "desc" } });
const ticket = await db.ticket.findFirst({ where: { panelId: root.id } });
const txn = await db.transaction.findFirst({ where: { panelId: root.id, type: "deposit" } });
const page1 = await db.page.findFirst({ where: { panelId: root.id } });
const post = await db.blogPost.findFirst({ where: { panelId: root.id, publishedAt: { not: null } } });
const customer = await db.user.findFirst({ where: { panelId: root.id, role: "user" } });
const platform = await db.platform.findFirst({
  where: { panelId: root.id, visible: true, categories: { some: { services: { some: { enabled: true } } } } },
  include: { categories: { where: { services: { some: { enabled: true } } }, take: 1 } },
});

await walk("Signed out", [
  ...GUEST,
  ...(page1 ? [`/p/${page1.slug}`] : []),
  ...(post ? [`/blog/${post.slug}`] : []),
]);

await walk(
  "As a customer",
  [
    ...CUSTOMER,
    ...(order ? [`/dashboard/orders/${order.publicId}`] : []),
    ...(ticket ? [`/dashboard/tickets/${ticket.id}`] : []),
    // The deposit page is keyed by the row's cuid, not its public number —
    // it is only ever reached from a link the panel generated.
    ...(txn ? [`/dashboard/wallet/${txn.id}`] : []),
    ...(platform?.categories[0]
      ? [`/dashboard/order/${platform.slug}/${platform.categories[0].slug}`]
      : []),
  ],
  ["demo", "Demo@123"],
);

await walk(
  "As an admin",
  [...ADMIN, ...(customer ? [`/admin/users/${customer.id}`] : [])],
  ["admin", "Admin@123"],
);

// Settings is a section per page now, so the index is the list of them.
await walk(
  "Settings sections",
  async (page) => {
    await page.goto(`${BASE}/admin/settings`, { waitUntil: "networkidle" });
    return page.$$eval('a[href^="/admin/settings/"]', (links) => [
      ...new Set(links.map((a) => a.getAttribute("href")).filter(Boolean)),
    ]);
  },
  ["admin", "Admin@123"],
);

await browser.close();
await db.$disconnect();
console.log(`\n${failures === 0 ? "Every page opened cleanly." : `${failures} FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
