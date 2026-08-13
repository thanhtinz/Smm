import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { builtinThemes } from "../src/lib/themes";
import { bundledDictionaries } from "../src/lib/dictionaries";

const db = new PrismaClient();

/** Filled in before anything else is seeded; every row below belongs to it. */
let PANEL = "";

const SEQ_START: Record<string, number> = { user: 1000, service: 1000, order: 100000, transaction: 100000, ticket: 1000 };

async function nextId(entity: string): Promise<number> {
  const start = SEQ_START[entity] ?? 1000;
  const existing = await db.counter.findUnique({ where: { panelId_name: { panelId: PANEL, name: entity } } });
  if (!existing) {
    await db.counter.create({ data: { panelId: PANEL, name: entity, value: start + 1 } });
    return start + 1;
  }
  return (
    await db.counter.update({
      where: { panelId_name: { panelId: PANEL, name: entity } },
      data: { value: { increment: 1 } },
    })
  ).value;
}

async function seedRootPanel(): Promise<string> {
  const existing = await db.panel.findFirst({ where: { parentId: null }, orderBy: { createdAt: "asc" } });
  const panel =
    existing ?? (await db.panel.create({ data: { slug: "root", name: "Root panel", depth: 0, path: "" } }));
  if (!panel.path) await db.panel.update({ where: { id: panel.id }, data: { path: panel.id } });

  const appHost = (() => {
    try {
      return new URL(process.env.APP_URL ?? "http://localhost:3000").hostname.toLowerCase();
    } catch {
      return "localhost";
    }
  })();

  const hosts = [...new Set([appHost, "localhost", "127.0.0.1"])];
  for (const [index, host] of hosts.entries()) {
    await db.panelDomain.upsert({
      where: { host },
      create: { panelId: panel.id, host, verified: true, isPrimary: index === 0 },
      update: { panelId: panel.id, verified: true },
    });
  }

  return panel.id;
}

/** Short, honest blurb rendered in the order summary. */
function describe(name: string): string {
  const bits: string[] = [];
  if (/vietnam/i.test(name)) bits.push("Targeted at Vietnamese accounts.");
  if (/real|high quality/i.test(name)) bits.push("Sourced from accounts with profile photos and activity.");
  if (/instant|fast/i.test(name)) bits.push("Starts within minutes of being placed.");
  if (/no refill/i.test(name)) bits.push("No refill guarantee — drops are not replaced.");
  else if (/refill/i.test(name)) bits.push("Covered by a refill guarantee for the stated period.");
  if (/non drop|ads safe/i.test(name)) bits.push("Safe for monetised accounts.");
  bits.push("Link must be public at the time the order is placed.");
  return bits.join(" ");
}

async function main() {
  // Every request resolves to a panel by host, and every row below belongs to
  // one, so the root panel comes first.
  PANEL = await seedRootPanel();

  // --- Languages ----------------------------------------------------------
  const languages = [
    { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", isDefault: true, position: 0 },
    { code: "en", name: "English", nativeName: "English", isDefault: false, position: 1 },
  ];
  for (const lang of languages) {
    const row = await db.language.upsert({
      where: { code: lang.code },
      create: lang,
      update: { name: lang.name, nativeName: lang.nativeName },
    });
    const dict = bundledDictionaries[lang.code] ?? {};
    for (const [key, value] of Object.entries(dict)) {
      await db.translation.upsert({
        where: { languageId_namespace_key: { languageId: row.id, namespace: "common", key } },
        create: { languageId: row.id, namespace: "common", key, value },
        update: {},
      });
    }
  }

  // --- Currencies (base = VND) --------------------------------------------
  const currencies = [
    { code: "VND", name: "Vietnamese Dong", symbol: "₫", symbolBefore: false, decimals: 0, rate: 1, isBase: true, position: 0 },
    { code: "USD", name: "US Dollar", symbol: "$", symbolBefore: true, decimals: 2, rate: 1 / 25400, isBase: false, position: 1 },
    { code: "EUR", name: "Euro", symbol: "€", symbolBefore: true, decimals: 2, rate: 1 / 27600, isBase: false, position: 2 },
    { code: "TRY", name: "Turkish Lira", symbol: "₺", symbolBefore: true, decimals: 2, rate: 1 / 740, isBase: false, position: 3 },
    { code: "INR", name: "Indian Rupee", symbol: "₹", symbolBefore: true, decimals: 2, rate: 1 / 300, isBase: false, position: 4 },
  ];
  for (const c of currencies) {
    await db.currency.upsert({ where: { code: c.code }, create: c, update: { name: c.name, symbol: c.symbol } });
  }

  // --- Themes -------------------------------------------------------------
  for (const [i, theme] of builtinThemes.entries()) {
    await db.theme.upsert({
      where: { slug: theme.slug },
      create: {
        slug: theme.slug,
        name: theme.name,
        description: theme.description,
        layout: theme.layout,
        tokens: JSON.stringify(theme.tokens),
        isDefault: i === 0,
        position: i,
      },
      update: { tokens: JSON.stringify(theme.tokens), name: theme.name, description: theme.description },
    });
  }

  // --- Users --------------------------------------------------------------
  const adminPass = await bcrypt.hash("Admin@123", 10);
  const userPass = await bcrypt.hash("Demo@123", 10);
  await db.user.upsert({
    where: { panelId_username: { panelId: PANEL, username: "admin" } },
    create: {
      panelId: PANEL,
      publicId: await nextId("user"),
      username: "admin",
      email: "admin@novapanel.io",
      password: adminPass,
      fullName: "Panel Administrator",
      role: "admin",
      balance: 0,
      emailVerified: true,
    },
    update: {},
  });
  await db.user.upsert({
    where: { panelId_username: { panelId: PANEL, username: "demo" } },
    create: {
      panelId: PANEL,
      publicId: await nextId("user"),
      username: "demo",
      email: "demo@novapanel.io",
      password: userPass,
      fullName: "Demo Reseller",
      role: "user",
      balance: 2_500_000,
      spent: 1_240_000,
      emailVerified: true,
    },
    update: {},
  });

  // --- Catalogue ----------------------------------------------------------
  const platforms = [
    { slug: "instagram", name: "Instagram", icon: "instagram", color: "#e1306c", position: 0 },
    { slug: "tiktok", name: "TikTok", icon: "tiktok", color: "#25f4ee", position: 1 },
    { slug: "youtube", name: "YouTube", icon: "youtube", color: "#ff0000", position: 2 },
    { slug: "facebook", name: "Facebook", icon: "facebook", color: "#1877f2", position: 3 },
    { slug: "twitter", name: "X / Twitter", icon: "twitter", color: "#8899a6", position: 4 },
    { slug: "telegram", name: "Telegram", icon: "telegram", color: "#229ed9", position: 5 },
    { slug: "spotify", name: "Spotify", icon: "spotify", color: "#1db954", position: 6 },
  ];
  for (const p of platforms) {
    await db.platform.upsert({
      where: { panelId_slug: { panelId: PANEL, slug: p.slug } },
      create: { ...p, panelId: PANEL },
      update: { name: p.name, icon: p.icon },
    });
  }

  const catalogue: Record<string, { category: string; services: [string, number, number, number][] }[]> = {
    instagram: [
      {
        category: "Instagram Followers",
        services: [
          ["Instagram Followers - Real Mix [30 days refill]", 21000, 100, 100000],
          ["Instagram Followers - Vietnam Targeted", 38000, 50, 50000],
          ["Instagram Followers - Instant Start [No refill]", 12000, 100, 200000],
        ],
      },
      {
        category: "Instagram Likes",
        services: [
          ["Instagram Likes - Real Accounts", 6500, 20, 50000],
          ["Instagram Likes - Vietnam Users", 14000, 20, 20000],
        ],
      },
      {
        category: "Instagram Views",
        services: [
          ["Instagram Reels Views - Fast", 900, 100, 10000000],
          ["Instagram Story Views", 4200, 100, 50000],
        ],
      },
    ],
    tiktok: [
      {
        category: "TikTok Followers",
        services: [
          ["TikTok Followers - Global Mix", 24000, 100, 100000],
          ["TikTok Followers - Vietnam Real", 46000, 50, 30000],
        ],
      },
      {
        category: "TikTok Views & Likes",
        services: [
          ["TikTok Video Views - Instant", 400, 100, 50000000],
          ["TikTok Likes - High Quality", 7800, 20, 100000],
        ],
      },
    ],
    youtube: [
      {
        category: "YouTube Views",
        services: [
          ["YouTube Views - Non Drop [Ads safe]", 62000, 500, 1000000],
          ["YouTube Shorts Views", 9000, 500, 5000000],
        ],
      },
      {
        category: "YouTube Subscribers",
        services: [["YouTube Subscribers - 60 days refill", 340000, 50, 20000]],
      },
    ],
    facebook: [
      {
        category: "Facebook Page & Profile",
        services: [
          ["Facebook Page Likes - Global", 28000, 100, 100000],
          ["Facebook Profile Followers - Vietnam", 33000, 100, 50000],
        ],
      },
      {
        category: "Facebook Engagement",
        services: [["Facebook Post Reactions - Mixed", 15000, 50, 30000]],
      },
    ],
    twitter: [
      {
        category: "X / Twitter Growth",
        services: [
          ["X Followers - Global", 96000, 100, 50000],
          ["X Post Likes", 18000, 20, 20000],
        ],
      },
    ],
    telegram: [
      {
        category: "Telegram Members & Views",
        services: [
          ["Telegram Channel Members - Real", 32000, 100, 100000],
          ["Telegram Post Views - Last 5 posts", 1200, 100, 1000000],
        ],
      },
    ],
    spotify: [
      {
        category: "Spotify Plays",
        services: [["Spotify Track Plays - Premium", 27000, 1000, 1000000]],
      },
    ],
  };

  for (const [slug, groups] of Object.entries(catalogue)) {
    const platform = await db.platform.findFirst({ where: { panelId: PANEL, slug } });
    if (!platform) continue;
    for (const [gi, group] of groups.entries()) {
      const existing = await db.category.findFirst({ where: { panelId: PANEL, name: group.category } });
      const category =
        existing ??
        (await db.category.create({
          data: { panelId: PANEL, name: group.category, platformId: platform.id, position: gi },
        }));
      for (const [si, [name, rate, min, max]] of group.services.entries()) {
        const found = await db.service.findFirst({ where: { panelId: PANEL, name } });
        if (found) continue;
        await db.service.create({
          data: {
            panelId: PANEL,
            publicId: await nextId("service"),
            categoryId: category.id,
            name,
            rate,
            providerRate: Math.round(rate * 0.62),
            min,
            max,
            refill: /refill/i.test(name) && !/no refill/i.test(name),
            cancel: true,
            // Gradual-delivery services are the ones worth drip-feeding.
            dripfeed: /view|like|follower/i.test(name),
            description: describe(name),
            averageTime: ["1 hour", "3 hours", "12 hours", "30 minutes"][si % 4],
            position: si,
          },
        });
      }
    }
  }

  // --- Payment methods ----------------------------------------------------
  const methods = [
    {
      code: "seapay",
      name: "SePay — Vietnam bank transfer",
      driver: "seapay",
      icon: "qrcode",
      description: "Chuyển khoản ngân hàng nội địa, tự động cộng tiền qua webhook SePay.",
      enabled: true,
      currencies: JSON.stringify(["VND"]),
      minAmount: 20000,
      maxAmount: 500000000,
      position: 0,
      config: JSON.stringify({
        apiToken: "",
        webhookSecret: "",
        accountNumber: "",
        bankCode: "MB",
        accountName: "",
        prefix: "NOVA",
        qrTemplate: "compact2",
      }),
    },
    {
      code: "paypal",
      name: "PayPal",
      driver: "paypal",
      icon: "paypal",
      description: "Pay with a PayPal balance or any major card.",
      enabled: true,
      currencies: JSON.stringify(["USD", "EUR"]),
      minAmount: 5,
      maxAmount: 10000,
      feePercent: 4.4,
      feeFixed: 0.3,
      position: 1,
      config: JSON.stringify({ clientId: "", clientSecret: "", mode: "sandbox" }),
    },
    {
      code: "link",
      name: "Link by Stripe",
      driver: "link",
      icon: "link",
      description: "One-click checkout with Link, cards and wallets.",
      enabled: true,
      currencies: JSON.stringify(["USD", "EUR"]),
      minAmount: 5,
      maxAmount: 10000,
      feePercent: 2.9,
      feeFixed: 0.3,
      position: 2,
      config: JSON.stringify({ publishableKey: "", secretKey: "", webhookSecret: "" }),
    },
    {
      code: "manual_bank",
      name: "Manual bank transfer",
      driver: "manual",
      icon: "bank",
      description: "Transfer manually and an operator credits your balance.",
      enabled: false,
      currencies: JSON.stringify(["VND", "USD"]),
      minAmount: 50000,
      position: 3,
      config: JSON.stringify({ instructions: "", accountNumber: "", accountName: "", bankName: "" }),
    },
  ];
  for (const m of methods) {
    await db.paymentMethod.upsert({
      where: { panelId_code: { panelId: PANEL, code: m.code } },
      create: { ...m, panelId: PANEL },
      update: { name: m.name, driver: m.driver },
    });
  }

  // --- Static pages -------------------------------------------------------
  const pages = [
    { slug: "terms", title: "Terms of service", body: "<p>Edit this page from Admin → Pages.</p>", position: 0 },
    { slug: "privacy", title: "Privacy policy", body: "<p>Edit this page from Admin → Pages.</p>", position: 1 },
    { slug: "refund", title: "Refund policy", body: "<p>Edit this page from Admin → Pages.</p>", position: 2 },
  ];
  for (const p of pages) {
    await db.page.upsert({
      where: { panelId_slug: { panelId: PANEL, slug: p.slug } },
      create: { ...p, panelId: PANEL },
      update: {},
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
