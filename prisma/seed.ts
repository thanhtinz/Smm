import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { builtinThemes } from "../src/lib/themes";
import { bundledDictionaries } from "../src/lib/dictionaries";
import { settingDefinitions } from "../src/lib/settings";

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

/** The same rule the admin form and the backfill use. */
function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // Every request resolves to a panel by host, and every row below belongs to
  // one, so the root panel comes first.
  PANEL = await seedRootPanel();

  // What language this install speaks, read once and used by everything below
  // that writes words a visitor will read. A setting only has a row once
  // somebody has changed it, so the registry's default is the answer for a
  // panel nobody has configured yet.
  //
  // Payment method names, static page titles and the FAQ are not translation
  // keys — they are content an operator edits — so the seed has to pick a
  // language rather than leave them for `t()`. Picking English on a
  // Vietnamese panel is how a home page ends up half in each.
  const storedLocale = await db.setting.findUnique({
    where: { panelId_key: { panelId: PANEL, key: "locale.default" } },
  });
  const locale = storedLocale ? JSON.parse(storedLocale.value) : settingDefinitions["locale.default"].value;
  const inVietnamese = locale === "vi";

  // The home page argues in one language of its own — `landing.locale`,
  // English out of the box — so the rows that show up on it follow that
  // rather than the panel's. A Vietnamese tagline under an English headline
  // is the same half-and-half page this was meant to fix, just the other way
  // round. Payment method names are not on it, and stay in the panel's
  // language, which is where a customer reads them.
  const storedLanding = await db.setting.findUnique({
    where: { panelId_key: { panelId: PANEL, key: "landing.locale" } },
  });
  const landingLocale = storedLanding ? JSON.parse(storedLanding.value) : settingDefinitions["landing.locale"].value;
  const landingVi = landingLocale === "vi";

  // --- Languages ----------------------------------------------------------
  // English is the default and Vietnamese sits beside it as an option; both
  // ship with a full dictionary, which is what "enabled" has to mean.
  //
  // The rest arrive switched off, and that is not caution — a language with
  // no strings falls through to English, so enabling one would give a reader
  // an English panel wearing a different name. Admin → Languages lists each
  // with how many of the keys are translated and opens an editor; the switch
  // is theirs to throw once that number is not zero. Seeding the rows saves
  // the operator writing out the code, the native name and the reading
  // direction for a language they were always going to add.
  const languages = [
    { code: "en", name: "English", nativeName: "English", isDefault: true, enabled: true, position: 0 },
    { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", isDefault: false, enabled: true, position: 1 },
    { code: "es", name: "Spanish", nativeName: "Español", isDefault: false, enabled: false, position: 2 },
    { code: "pt", name: "Portuguese", nativeName: "Português", isDefault: false, enabled: false, position: 3 },
    { code: "fr", name: "French", nativeName: "Français", isDefault: false, enabled: false, position: 4 },
    { code: "de", name: "German", nativeName: "Deutsch", isDefault: false, enabled: false, position: 5 },
    { code: "it", name: "Italian", nativeName: "Italiano", isDefault: false, enabled: false, position: 6 },
    { code: "ru", name: "Russian", nativeName: "Русский", isDefault: false, enabled: false, position: 7 },
    { code: "tr", name: "Turkish", nativeName: "Türkçe", isDefault: false, enabled: false, position: 8 },
    { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl", isDefault: false, enabled: false, position: 9 },
    { code: "ur", name: "Urdu", nativeName: "اردو", direction: "rtl", isDefault: false, enabled: false, position: 10 },
    { code: "hi", name: "Hindi", nativeName: "हिन्दी", isDefault: false, enabled: false, position: 11 },
    { code: "bn", name: "Bengali", nativeName: "বাংলা", isDefault: false, enabled: false, position: 12 },
    { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", isDefault: false, enabled: false, position: 13 },
    { code: "th", name: "Thai", nativeName: "ไทย", isDefault: false, enabled: false, position: 14 },
    { code: "zh", name: "Chinese", nativeName: "中文", isDefault: false, enabled: false, position: 15 },
    { code: "ja", name: "Japanese", nativeName: "日本語", isDefault: false, enabled: false, position: 16 },
    { code: "ko", name: "Korean", nativeName: "한국어", isDefault: false, enabled: false, position: 17 },
  ];
  for (const lang of languages) {
    const row = await db.language.upsert({
      where: { code: lang.code },
      create: lang,
      // Not `enabled`, and not `isDefault`: an operator who switched a
      // language on, or made one the default, has said something this file
      // has no business undoing on the next deploy.
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

  // --- Currencies (base = USD) --------------------------------------------
  // `rate` is what one dollar is worth in this currency, and every stored
  // amount in the panel is in dollars.
  //
  // These are starting rates, not live ones — they are as good as the day
  // this file was written and no better. Admin → Localisation has an
  // automatic updater (`currency.autoUpdate`) that replaces them from a feed;
  // an operator who leaves it off is quoting yesterday's prices, which is
  // fine at these margins and their choice either way. A row edited by hand
  // clears its own `autoUpdate` and stops being overwritten.
  //
  // The set is the markets SMM panels actually sell into. Adding another is
  // one row in Admin → Currencies; nothing here is a fixed list.
  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$", symbolBefore: true, decimals: 2, rate: 1, isBase: true, position: 0 },
    { code: "EUR", name: "Euro", symbol: "€", symbolBefore: true, decimals: 2, rate: 0.92, isBase: false, position: 1 },
    { code: "GBP", name: "Pound Sterling", symbol: "£", symbolBefore: true, decimals: 2, rate: 0.79, isBase: false, position: 2 },
    { code: "VND", name: "Vietnamese Dong", symbol: "₫", symbolBefore: false, decimals: 0, rate: 25400, isBase: false, position: 3 },
    { code: "INR", name: "Indian Rupee", symbol: "₹", symbolBefore: true, decimals: 2, rate: 83.5, isBase: false, position: 4 },
    { code: "BRL", name: "Brazilian Real", symbol: "R$", symbolBefore: true, decimals: 2, rate: 5.45, isBase: false, position: 5 },
    { code: "TRY", name: "Turkish Lira", symbol: "₺", symbolBefore: true, decimals: 2, rate: 32.5, isBase: false, position: 6 },
    { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", symbolBefore: true, decimals: 0, rate: 15800, isBase: false, position: 7 },
    { code: "PHP", name: "Philippine Peso", symbol: "₱", symbolBefore: true, decimals: 2, rate: 57.5, isBase: false, position: 8 },
    { code: "THB", name: "Thai Baht", symbol: "฿", symbolBefore: true, decimals: 2, rate: 36.5, isBase: false, position: 9 },
    { code: "NGN", name: "Nigerian Naira", symbol: "₦", symbolBefore: true, decimals: 0, rate: 1500, isBase: false, position: 10 },
    { code: "PKR", name: "Pakistani Rupee", symbol: "₨", symbolBefore: true, decimals: 0, rate: 278, isBase: false, position: 11 },
    { code: "BDT", name: "Bangladeshi Taka", symbol: "৳", symbolBefore: true, decimals: 0, rate: 117, isBase: false, position: 12 },
    { code: "RUB", name: "Russian Ruble", symbol: "₽", symbolBefore: false, decimals: 2, rate: 92, isBase: false, position: 13 },
    { code: "MXN", name: "Mexican Peso", symbol: "MX$", symbolBefore: true, decimals: 2, rate: 17.2, isBase: false, position: 14 },
    { code: "AED", name: "UAE Dirham", symbol: "د.إ", symbolBefore: false, decimals: 2, rate: 3.67, isBase: false, position: 15 },
  ];
  for (const c of currencies) {
    await db.currency.upsert({
      where: { code: c.code },
      create: c,
      // Never the rate: a panel that has been running has either updated it
      // from the feed or pinned it by hand, and both are worth more than the
      // number frozen into this file.
      update: { name: c.name, symbol: c.symbol },
    });
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
      balance: 100,
      spent: 48.5,
      emailVerified: true,
    },
    update: {},
  });

  // --- Catalogue ----------------------------------------------------------
  // The link rules ship as a working starting point, not as law: every one of
  // them is edited in Admin -> Platforms, which is the only way a panel can
  // sell on a platform this file has never heard of.
  const platforms = [
    {
      slug: "instagram", name: "Instagram", icon: "instagram", color: "#e1306c", position: 0,
      hosts: "instagram.com, instagr.am",
      postPattern: String.raw`^/(p|reel|reels|tv)/[\w-]+`,
      profilePattern: String.raw`^/[\w.]+/?$`,
      postExample: "https://instagram.com/p/Cx1y2z3aBcD",
      profileExample: "https://instagram.com/nova",
    },
    {
      // Threads posts are addressed by a code under the author's handle, and
      // the profile is the handle on its own — the same shape Instagram uses,
      // which is what Threads accounts are.
      slug: "threads", name: "Threads", icon: "megaphone", color: "#000000", position: 1,
      hosts: "threads.net, threads.com",
      postPattern: String.raw`^/@[\w.]+/post/[\w-]+`,
      profilePattern: String.raw`^/@[\w.]+/?$`,
      postExample: "https://threads.net/@nova/post/Cx1y2z3aBcD",
      profileExample: "https://threads.net/@nova",
    },
    {
      slug: "tiktok", name: "TikTok", icon: "tiktok", color: "#25f4ee", position: 2,
      hosts: "tiktok.com, vt.tiktok.com",
      postPattern: String.raw`^/@[\w.]+/video/\d+`,
      profilePattern: String.raw`^/@[\w.]+/?$`,
      postExample: "https://tiktok.com/@nova/video/7123456789012345678",
      profileExample: "https://tiktok.com/@nova",
    },
    {
      slug: "youtube", name: "YouTube", icon: "youtube", color: "#ff0000", position: 3,
      hosts: "youtube.com, youtu.be",
      postPattern: String.raw`^(/watch\?v=[\w-]+|/shorts/[\w-]+|/[\w-]{11}$)`,
      profilePattern: String.raw`^(/@[\w.-]+|/(channel|c|user)/[\w-]+)/?$`,
      postExample: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      profileExample: "https://youtube.com/@nova",
    },
    {
      slug: "facebook", name: "Facebook", icon: "facebook", color: "#1877f2", position: 4,
      hosts: "facebook.com, fb.com, fb.watch",
      postPattern: String.raw`(/posts/|/videos/|/photo|/reel/|story_fbid=|/permalink)`,
      profilePattern: String.raw`^/(profile\.php\?id=\d+|[\w.]+)/?$`,
      postExample: "https://facebook.com/nova/posts/123456789",
      profileExample: "https://facebook.com/nova",
    },
    {
      slug: "twitter", name: "X / Twitter", icon: "twitter", color: "#8899a6", position: 4,
      hosts: "twitter.com, x.com",
      postPattern: String.raw`^/[\w]+/status/\d+`,
      profilePattern: String.raw`^/[\w]+/?$`,
      postExample: "https://x.com/nova/status/1234567890123456789",
      profileExample: "https://x.com/nova",
    },
    {
      slug: "telegram", name: "Telegram", icon: "telegram", color: "#229ed9", position: 5,
      hosts: "t.me, telegram.me",
      postPattern: String.raw`^/[\w_]+/\d+`,
      profilePattern: String.raw`^/[\w_]+/?$`,
      postExample: "https://t.me/nova/42",
      profileExample: "https://t.me/nova",
    },
    {
      slug: "spotify", name: "Spotify", icon: "spotify", color: "#1db954", position: 6,
      hosts: "open.spotify.com, spotify.com",
      postPattern: String.raw`^/(track|album|episode)/[\w]+`,
      profilePattern: String.raw`^/(artist|user|playlist)/[\w]+`,
      postExample: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT",
      profileExample: "https://open.spotify.com/artist/1vCWHaC5f2uS3yhpwWbIA6",
    },
  ];
  // The real brand mark, in the platform's own colours, shipped as a file
  // rather than drawn from the icon set. The glyph stays as the fallback: it
  // is what a platform an operator adds themselves gets until they upload
  // something, and what any of these fall back to if the file is missing.
  //
  // Written only on create, and only where the operator has not uploaded
  // their own — a re-run of the seed must not undo an upload.
  for (const p of platforms) {
    const existing = await db.platform.findUnique({
      where: { panelId_slug: { panelId: PANEL, slug: p.slug } },
      select: { image: true },
    });
    const image = `/platforms/${p.slug}.svg`;

    await db.platform.upsert({
      where: { panelId_slug: { panelId: PANEL, slug: p.slug } },
      create: { ...p, image, panelId: PANEL },
      update: {
        ...(existing?.image ? {} : { image }),
        name: p.name,
        icon: p.icon,
        hosts: p.hosts,
        postPattern: p.postPattern,
        profilePattern: p.profilePattern,
        postExample: p.postExample,
        profileExample: p.profileExample,
      },
    });
  }

  // [name, price per 1000, minimum, maximum]. The price is in the base
  // currency — dollars — and every one of these is a plausible market rate
  // rather than a real supplier's, because there is no supplier until the
  // operator connects one.
  const catalogue: Record<string, { category: string; services: [string, number, number, number][] }[]> = {
    instagram: [
      {
        category: "Instagram Followers",
        services: [
          ["Instagram Followers - Real Mix [30 days refill]", 0.85, 100, 100000],
          ["Instagram Followers - Vietnam Targeted", 1.5, 50, 50000],
          ["Instagram Followers - Instant Start [No refill]", 0.48, 100, 200000],
        ],
      },
      {
        category: "Instagram Likes",
        services: [
          ["Instagram Likes - Real Accounts", 0.26, 20, 50000],
          ["Instagram Likes - Vietnam Users", 0.55, 20, 20000],
        ],
      },
      {
        category: "Instagram Views",
        services: [
          ["Instagram Reels Views - Fast", 0.04, 100, 10000000],
          ["Instagram Story Views", 0.17, 100, 50000],
        ],
      },
    ],
    tiktok: [
      {
        category: "TikTok Followers",
        services: [
          ["TikTok Followers - Global Mix", 0.95, 100, 100000],
          ["TikTok Followers - Vietnam Real", 1.8, 50, 30000],
        ],
      },
      {
        category: "TikTok Views & Likes",
        services: [
          ["TikTok Video Views - Instant", 0.02, 100, 50000000],
          ["TikTok Likes - High Quality", 0.31, 20, 100000],
        ],
      },
    ],
    youtube: [
      {
        category: "YouTube Views",
        services: [
          ["YouTube Views - Non Drop [Ads safe]", 2.45, 500, 1000000],
          ["YouTube Shorts Views", 0.36, 500, 5000000],
        ],
      },
      {
        category: "YouTube Subscribers",
        services: [["YouTube Subscribers - 60 days refill", 13.4, 50, 20000]],
      },
    ],
    facebook: [
      {
        category: "Facebook Page & Profile",
        services: [
          ["Facebook Page Likes - Global", 1.1, 100, 100000],
          ["Facebook Profile Followers - Vietnam", 1.3, 100, 50000],
        ],
      },
      {
        category: "Facebook Engagement",
        services: [["Facebook Post Reactions - Mixed", 0.6, 50, 30000]],
      },
    ],
    twitter: [
      {
        category: "X / Twitter Growth",
        services: [
          ["X Followers - Global", 3.8, 100, 50000],
          ["X Post Likes", 0.7, 20, 20000],
        ],
      },
    ],
    telegram: [
      {
        category: "Telegram Members & Views",
        services: [
          ["Telegram Channel Members - Real", 1.25, 100, 100000],
          ["Telegram Post Views - Last 5 posts", 0.05, 100, 1000000],
        ],
      },
    ],
    spotify: [
      {
        category: "Spotify Plays",
        services: [["Spotify Track Plays - Premium", 1.05, 1000, 1000000]],
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
          data: {
            panelId: PANEL,
            name: group.category,
            // Its address, unique under this platform. Without one every
            // category on a platform would share the empty default and the
            // second create would collide.
            slug: slugify(group.category),
            platformId: platform.id,
            position: gi,
          },
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
            // A notional cost price, so the margin column has something to
            // show. Rounded to four places, not to a whole unit: in dollars a
            // whole unit is the entire price — Math.round would have put the
            // cost of a $0.85 service at $1 and shown the panel losing money
            // on every order.
            providerRate: Math.round(rate * 0.62 * 10000) / 10000,
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

  // --- Branding text ------------------------------------------------------
  // Written once and edited in admin afterwards, so the seed has to choose a
  // language for them the same way the pages and the FAQ do. Only written
  // where nobody has set them: an operator's own words are never overwritten
  // by a re-run of the seed.
  if (landingVi) {
    const branding: Record<string, string> = {
      "site.tagline": "Tăng trưởng mạng xã hội, giao tận nơi",
      "site.description":
        "Panel SMM đặt đơn trong một phút, chạy tự động, giá minh bạch và có người thật trả lời khi cần.",
    };
    for (const [key, value] of Object.entries(branding)) {
      const already = await db.setting.findUnique({ where: { panelId_key: { panelId: PANEL, key } } });
      if (!already) {
        await db.setting.create({ data: { panelId: PANEL, key, value: JSON.stringify(value), group: "branding" } });
      }
    }
  }

  // --- Payment methods ----------------------------------------------------
  const methods = [
    {
      code: "seapay",
      name: inVietnamese ? "SePay — Chuyển khoản ngân hàng" : "SePay — Vietnam bank transfer",
      driver: "seapay",
      icon: "qrcode",
      description: inVietnamese
        ? "Chuyển khoản ngân hàng nội địa, tự động cộng tiền qua webhook SePay."
        : "Vietnamese domestic bank transfer, credited automatically by the SePay webhook.",
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
      description: inVietnamese ? "Trả bằng số dư PayPal hoặc thẻ quốc tế." : "Pay with a PayPal balance or any major card.",
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
      name: inVietnamese ? "Thẻ quốc tế (Link by Stripe)" : "Link by Stripe",
      driver: "link",
      icon: "link",
      description: inVietnamese ? "Thanh toán một chạm bằng Link, thẻ và ví điện tử." : "One-click checkout with Link, cards and wallets.",
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
      code: "crypto",
      name: inVietnamese ? "Tiền mã hoá" : "Crypto",
      driver: "crypto",
      icon: "bitcoin",
      description: inVietnamese
        ? "Trả bằng USDT, BTC hoặc coin khác; cộng tiền khi mạng xác nhận."
        : "Pay in USDT, BTC or another coin; credited once the network confirms.",
      enabled: false,
      currencies: JSON.stringify(["USD"]),
      minAmount: 5,
      maxAmount: 50000,
      feePercent: 1,
      feeFixed: 0,
      position: 3,
      config: JSON.stringify({ apiKey: "", ipnSecret: "", payCurrency: "", apiUrl: "", prefix: "NOVA" }),
    },
    {
      // The two wallets this market actually pays from. Seeded switched off
      // and unconfigured, like the rest: a driver nobody can see in the admin
      // area is a driver nobody uses.
      code: "momo",
      name: "MoMo",
      driver: "momo",
      icon: "wallet",
      description: "Pay from the MoMo wallet.",
      enabled: false,
      currencies: JSON.stringify(["VND"]),
      minAmount: 10000,
      maxAmount: 50000000,
      position: 1,
      config: JSON.stringify({ partnerCode: "", accessKey: "", secretKey: "", apiUrl: "" }),
    },
    {
      code: "zalopay",
      name: "ZaloPay",
      driver: "zalopay",
      icon: "wallet",
      description: "Pay from the ZaloPay wallet.",
      enabled: false,
      currencies: JSON.stringify(["VND"]),
      minAmount: 10000,
      maxAmount: 50000000,
      position: 2,
      config: JSON.stringify({ appId: "", key1: "", key2: "", apiUrl: "" }),
    },
    {
      code: "manual_bank",
      name: inVietnamese ? "Chuyển khoản thủ công" : "Manual bank transfer",
      driver: "manual",
      icon: "bank",
      description: inVietnamese
        ? "Chuyển khoản rồi nhân viên cộng tiền vào số dư cho bạn."
        : "Transfer manually and an operator credits your balance.",
      enabled: false,
      currencies: JSON.stringify(["VND", "USD"]),
      minAmount: 50000,
      position: 4,
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
  const pageBody = landingVi
    ? "<p>Sửa trang này trong Quản trị → Trang tĩnh.</p>"
    : "<p>Edit this page from Admin → Pages.</p>";
  const pages = landingVi
    ? [
        { slug: "terms", title: "Điều khoản sử dụng", body: pageBody, position: 0 },
        { slug: "privacy", title: "Chính sách bảo mật", body: pageBody, position: 1 },
        { slug: "refund", title: "Chính sách hoàn tiền", body: pageBody, position: 2 },
      ]
    : [
        { slug: "terms", title: "Terms of service", body: pageBody, position: 0 },
        { slug: "privacy", title: "Privacy policy", body: pageBody, position: 1 },
        { slug: "refund", title: "Refund policy", body: pageBody, position: 2 },
      ];
  for (const p of pages) {
    await db.page.upsert({
      where: { panelId_slug: { panelId: PANEL, slug: p.slug } },
      create: { ...p, panelId: PANEL },
      update: {},
    });
  }

  // --- Landing FAQ --------------------------------------------------------
  // Starter questions, because these four are asked of every panel in this
  // market. They are meant to be edited from Admin → Home page, not kept, and
  // they are written in whatever language the panel defaults to so the home
  // page does not open in two languages at once.
  const faqs = landingVi
    ? [
        {
          question: "Đơn bao lâu thì bắt đầu chạy?",
          answer:
            "Phần lớn dịch vụ bắt đầu trong vài phút sau khi đơn sang nhà cung cấp. Mỗi dịch vụ đều ghi thời gian trung bình của riêng nó ngay trên form đặt đơn.",
          position: 0,
        },
        {
          question: "Bị tụt thì sao?",
          answer:
            "Dịch vụ nào có bảo hành thì mở đơn ra và bấm yêu cầu bù, phần hụt sẽ được thêm lại. Dịch vụ không có bảo hành thì chỉ giao một lần.",
          position: 1,
        },
        {
          question: "Nạp tiền bằng cách nào?",
          answer:
            "Vào mục Ví tiền. Có chuyển khoản ngân hàng, thẻ và crypto, tuỳ theo panel này bật cổng nào.",
          position: 2,
        },
        {
          question: "Có huỷ đơn được không?",
          answer:
            "Đơn còn đang chờ hoặc đang chạy thì gửi yêu cầu huỷ được. Phần đã giao sẽ được hoàn lại theo đúng tỉ lệ.",
          position: 3,
        },
      ]
    : [
        {
          question: "How long does an order take to start?",
          answer:
            "Most services start within minutes of the order reaching the provider. Each service lists its own average time on the order form.",
          position: 0,
        },
        {
          question: "What happens if the count drops?",
          answer:
            "Services marked with refill can be topped back up: open the order and ask for a refill. Services without it are delivered once.",
          position: 1,
        },
        {
          question: "How do I add balance?",
          answer: "From Wallet. Bank transfer, card and crypto are available depending on what this panel has enabled.",
          position: 2,
        },
        {
          question: "Can I cancel an order?",
          answer:
            "While an order is still pending or processing you can request a cancellation. Anything already delivered is refunded pro rata.",
          position: 3,
        },
      ];
  // All or nothing on the table, for the same reason the testimonials below
  // are. Matching row by row on the question text meant that flipping
  // `landing.locale` and re-seeding added the four translated questions
  // *beside* the four already there — the home page then asked everything
  // twice, once in each language, which is the exact thing this block picks a
  // language to avoid.
  if ((await db.faq.count({ where: { panelId: PANEL } })) === 0) {
    for (const f of faqs) {
      await db.faq.create({ data: { ...f, panelId: PANEL } });
    }
  }

  // --- Landing testimonials ------------------------------------------------
  // Written out and switched on, at the operator's direction, so the section
  // reads as a finished page rather than as three empty cards.
  //
  // What they say is deliberately narrow: how the panel behaves — the order
  // form, the API, refills, a support reply — and never a number. A seeded
  // "we got 40k followers" would be a fabricated result attributed to a named
  // customer, and it is the one thing here that could actually mislead a
  // buyer. These describe the software, which is the part that is true on a
  // fresh install. They are still the operator's to replace with real ones:
  // Admin → Home page.
  const quotes = landingVi
    ? [
        {
          name: "Minh Trí",
          role: "Chủ shop thời trang",
          body: "Đặt đơn xong là chạy, không phải nhắn ai để nhờ đẩy. Đơn nào cũng thấy rõ đã giao tới đâu nên tôi không phải ngồi đoán.",
          rating: 5,
          position: 0,
        },
        {
          name: "Thu Hà",
          role: "Agency truyền thông",
          body: "Bên tôi chạy cho nhiều khách nên cần API, và API ở đây đúng chuẩn nên cắm vào hệ thống sẵn có mất một buổi là xong.",
          rating: 5,
          position: 1,
        },
        {
          name: "Quốc Bảo",
          role: "Nhà sáng tạo nội dung",
          body: "Có lần bị tụt, tôi bấm yêu cầu bù ngay trong đơn và được xử lý, không phải mở ticket rồi chờ.",
          rating: 5,
          position: 2,
        },
        {
          name: "Lan Phương",
          role: "Đại lý",
          body: "Bảng giá rõ ràng, nạp tiền bằng chuyển khoản là vào ví gần như ngay. Hỏi gì hỗ trợ cũng trả lời trong ngày.",
          rating: 4,
          position: 3,
        },
      ]
    : [
        {
          name: "Daniel Ortiz",
          role: "Online shop owner",
          body: "Orders go out the moment I place them, and every one shows how much has actually been delivered. I am not chasing anybody to find out.",
          rating: 5,
          position: 0,
        },
        {
          name: "Priya Raman",
          role: "Marketing agency",
          body: "We run campaigns for a dozen clients, so we needed the API. It follows the standard one, and wiring it into what we already had took an afternoon.",
          rating: 5,
          position: 1,
        },
        {
          name: "Marco Silva",
          role: "Creator",
          body: "A count dropped once. I asked for a refill from the order itself and it was handled — no ticket, no waiting around.",
          rating: 5,
          position: 2,
        },
        {
          name: "Aisha Bello",
          role: "Reseller",
          body: "Prices are on the page before I sign in, top-ups land in the balance straight away, and support answers the same day.",
          rating: 4,
          position: 3,
        },
      ];
  // All or nothing, keyed on the table rather than on each row: a panel that
  // has one testimonial of its own has started writing them, and dropping
  // three templates in beside it would be the seed editing the operator's
  // page. Checking row by row did exactly that on a re-run.
  if ((await db.testimonial.count({ where: { panelId: PANEL } })) === 0) {
    for (const q of quotes) {
      await db.testimonial.create({ data: { ...q, visible: true, panelId: PANEL } });
    }
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
