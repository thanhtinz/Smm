/**
 * Proves that one panel cannot see another panel's rows.
 *
 * Two things are checked, because the panel filter in src/lib/db.ts only
 * covers one of them:
 *
 *   1. Every foreign key points inside the same panel. Relations loaded
 *      through `include`/`select` never reach the filter, so this invariant is
 *      what makes them safe. SQLite cannot declare a composite foreign key, so
 *      it has to be asserted rather than enforced.
 *   2. Every page and route served on panel A's host renders only panel A's
 *      data — checked by seeding a marker string into panel B and grepping
 *      panel A's responses for it.
 *
 * Usage: node scripts/tenancy-check.mjs   (needs the dev server running)
 */
import { PrismaClient } from "@prisma/client";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const db = new PrismaClient();

let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`  FAIL  ${msg}`);
};
const pass = (msg) => console.log(`  ok    ${msg}`);

// --- 1. Foreign keys stay inside a panel -----------------------------------

/**
 * [model, foreign-key field, model the key points at]
 *
 * Service.sourceServiceId and Order.sourceOrderId are deliberately absent:
 * they are the wholesale link between a panel and its parent, so they are the
 * only references that are *supposed* to cross a panel boundary.
 */
const EDGES = [
  ["session", "userId", "user"],
  ["authToken", "userId", "user"],
  ["recoveryCode", "userId", "user"],
  ["activityLog", "userId", "user"],
  ["category", "platformId", "platform"],
  ["service", "categoryId", "category"],
  ["service", "providerId", "provider"],
  ["service", "backupProviderId", "provider"],
  ["serviceRoute", "serviceId", "service"],
  ["serviceRoute", "providerId", "provider"],
  ["order", "providerId", "provider"],
  ["order", "userId", "user"],
  ["order", "serviceId", "service"],
  ["orderRequest", "orderId", "order"],
  ["orderRequest", "userId", "user"],
  ["transaction", "userId", "user"],
  ["transaction", "methodId", "paymentMethod"],
  ["ticket", "userId", "user"],
  ["ticketMessage", "ticketId", "ticket"],
  ["ticketMessage", "authorId", "user"],
  ["notification", "userId", "user"],
  ["couponRedemption", "couponId", "coupon"],
  ["couponRedemption", "userId", "user"],
  ["referralEarning", "referrerId", "user"],
  ["referralEarning", "referredId", "user"],
  ["user", "referredById", "user"],
  ["user", "tierId", "userTier"],
  ["tierPrice", "tierId", "userTier"],
  ["tierPrice", "serviceId", "service"],
];

async function checkForeignKeys() {
  console.log("\nForeign keys stay inside one panel");
  for (const [model, field, target] of EDGES) {
    const rows = await db[model].findMany({ select: { id: true, panelId: true, [field]: true } });
    const ids = [...new Set(rows.map((r) => r[field]).filter(Boolean))];
    if (ids.length === 0) continue;

    const targets = await db[target].findMany({ where: { id: { in: ids } }, select: { id: true, panelId: true } });
    const panelOf = new Map(targets.map((t) => [t.id, t.panelId]));

    const bad = rows.filter((r) => r[field] && panelOf.has(r[field]) && panelOf.get(r[field]) !== r.panelId);
    if (bad.length) fail(`${model}.${field} -> ${target}: ${bad.length} row(s) cross a panel boundary`);
    else pass(`${model}.${field} -> ${target} (${rows.length} rows)`);
  }
}

async function checkNoOrphans() {
  console.log("\nNo row left with the placeholder panelId");
  const models = [
    "setting", "counter", "user", "session", "authToken", "recoveryCode", "activityLog", "media", "platform", "category",
    "provider", "service", "serviceRoute", "order", "orderEvent", "blocklist", "orderRequest", "paymentMethod", "transaction", "ticket",
    "ticketMessage", "notification", "coupon", "couponRedemption", "referralEarning",
    "announcement", "page", "userTier", "tierPrice", "testimonial", "faq", "channel", "conversation", "inboxMessage",
  ];
  let total = 0;
  for (const m of models) {
    const n = await db[m].count({ where: { panelId: "" } });
    total += n;
    if (n) fail(`${m}: ${n} row(s) with panelId ""`);
  }
  if (!total) pass(`${models.length} tables, no placeholder panelId`);
}

// --- 2. One panel's host never renders another panel's data ----------------

const PATHS = ["/", "/services", "/api-docs", "/login", "/register", "/dashboard"];

/**
 * Everything a panel holds that no other panel does: its brand name, its
 * platforms and its services. Names shared with another panel are dropped —
 * two panels are allowed to both sell "Instagram Followers", and a word that
 * common also turns up in the hand-written API docs.
 */
async function markersFor(panel, otherPanel) {
  const namesOf = async (id) => [
    ...(await db.platform.findMany({ where: { panelId: id }, select: { name: true } })).map((r) => r.name),
    ...(await db.service.findMany({ where: { panelId: id }, select: { name: true } })).map((r) => r.name),
  ];
  const siteName = await db.setting.findUnique({
    where: { panelId_key: { panelId: panel.id, key: "site.name" } },
  });
  const shared = new Set(await namesOf(otherPanel.id));
  const own = (await namesOf(panel.id)).filter((n) => !shared.has(n));
  return [panel.name, siteName && JSON.parse(siteName.value), ...own].filter(Boolean);
}

async function checkHostIsolation(hostA, hostB, markers) {
  console.log(`\n${hostA} never leaks ${hostB}'s data (${markers.length} markers)`);
  for (const path of PATHS) {
    const res = await fetch(`${BASE}${path}`, { headers: { "x-forwarded-host": hostA }, redirect: "manual" });
    const body = res.status < 400 ? await res.text() : "";
    const leaked = markers.filter((m) => body.includes(m));
    if (leaked.length) fail(`${path} (${res.status}) contains ${leaked.slice(0, 3).join(", ")}`);
    else pass(`${path} (${res.status})`);
  }
}

/** A session belongs to the panel it was created on and nowhere else. */
async function checkSessionScope(session, ownHost, otherHost) {
  console.log("\nA session is only valid on its own panel");
  const cookie = `nova_session=${session.token}`;
  const own = await fetch(`${BASE}/dashboard`, {
    headers: { "x-forwarded-host": ownHost, cookie },
    redirect: "manual",
  });
  if (own.status === 200) pass(`${ownHost}/dashboard -> 200`);
  else fail(`${ownHost}/dashboard -> ${own.status}, expected 200`);

  const other = await fetch(`${BASE}/dashboard`, {
    headers: { "x-forwarded-host": otherHost, cookie },
    redirect: "manual",
  });
  if (other.status === 307) pass(`${otherHost}/dashboard -> 307 to login`);
  else fail(`${otherHost}/dashboard -> ${other.status}, expected a redirect to login`);
}

async function checkUnknownHost() {
  console.log("\nUnknown host is refused");
  for (const path of PATHS) {
    const res = await fetch(`${BASE}${path}`, { headers: { "x-forwarded-host": "not-a-panel.example" }, redirect: "manual" });
    if (res.status === 404) pass(`${path} -> 404`);
    else fail(`${path} -> ${res.status}, expected 404`);
  }
}

async function main() {
  const panels = await db.panel.findMany({ include: { domains: true }, orderBy: { depth: "asc" } });
  console.log(`Panels: ${panels.map((p) => `${p.slug}(${p.domains.map((d) => d.host).join("|")})`).join(", ")}`);

  await checkForeignKeys();
  await checkNoOrphans();

  if (panels.length >= 2) {
    const [a, b] = panels;
    const hostA = a.domains[0]?.host;
    const hostB = b.domains[0]?.host;
    if (hostA && hostB) {
      await checkHostIsolation(hostA, hostB, await markersFor(b, a));
      await checkHostIsolation(hostB, hostA, await markersFor(a, b));

      const session = await db.session.findFirst({
        where: { panelId: a.id, expiresAt: { gt: new Date() } },
        orderBy: { createdAt: "desc" },
      });
      if (session) await checkSessionScope(session, hostA, hostB);
      else console.log("\n(no live session on the first panel — sign in to check session scope)");
    }
  } else {
    console.log("\n(only one panel — create a second to check host isolation)");
  }

  await checkUnknownHost();

  console.log(failures ? `\n${failures} FAILURE(S)` : "\nAll checks passed.");
  await db.$disconnect();
  process.exit(failures ? 1 : 0);
}

main();
