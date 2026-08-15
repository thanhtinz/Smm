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
      slug: "tiktok", name: "TikTok", icon: "tiktok", color: "#25f4ee", position: 1,
      hosts: "tiktok.com, vt.tiktok.com",
      postPattern: String.raw`^/@[\w.]+/video/\d+`,
      profilePattern: String.raw`^/@[\w.]+/?$`,
      postExample: "https://tiktok.com/@nova/video/7123456789012345678",
      profileExample: "https://tiktok.com/@nova",
    },
    {
      slug: "youtube", name: "YouTube", icon: "youtube", color: "#ff0000", position: 2,
      hosts: "youtube.com, youtu.be",
      postPattern: String.raw`^(/watch\?v=[\w-]+|/shorts/[\w-]+|/[\w-]{11}$)`,
      profilePattern: String.raw`^(/@[\w.-]+|/(channel|c|user)/[\w-]+)/?$`,
      postExample: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      profileExample: "https://youtube.com/@nova",
    },
    {
      slug: "facebook", name: "Facebook", icon: "facebook", color: "#1877f2", position: 3,
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
  for (const p of platforms) {
    await db.platform.upsert({
      where: { panelId_slug: { panelId: PANEL, slug: p.slug } },
      create: { ...p, panelId: PANEL },
      update: {
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

  // --- Branding text ------------------------------------------------------
  // Written once and edited in admin afterwards, so the seed has to choose a
  // language for them the same way the pages and the FAQ do. Only written
  // where nobody has set them: an operator's own words are never overwritten
  // by a re-run of the seed.
  if (inVietnamese) {
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
  const pageBody = inVietnamese
    ? "<p>Sửa trang này trong Quản trị → Trang tĩnh.</p>"
    : "<p>Edit this page from Admin → Pages.</p>";
  const pages = inVietnamese
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
  //
  // The testimonials below are seeded hidden. An operator asked for them so
  // the section is not empty on a fresh install, and rows they can edit are a
  // reasonable thing to ship — but four invented customers praising a panel
  // that has served nobody are not a placeholder, they are a claim, and one
  // made to buyers. So they arrive written as templates with the blanks
  // showing, switched off, one toggle away from being published by whoever
  // decides to. Admin → Home page.
  const faqs = inVietnamese
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
  for (const f of faqs) {
    const exists = await db.faq.findFirst({ where: { panelId: PANEL, question: f.question } });
    if (!exists) await db.faq.create({ data: { ...f, panelId: PANEL } });
  }

  // --- Landing testimonials (hidden) --------------------------------------
  const quotes = inVietnamese
    ? [
        { name: "Tên khách hàng", role: "Shop thời trang", body: "Viết lại câu này bằng nhận xét thật của khách. Nói rõ họ mua dịch vụ gì và kết quả ra sao.", rating: 5, position: 0 },
        { name: "Tên khách hàng", role: "Agency", body: "Một câu về tốc độ giao đơn hoặc về việc hỗ trợ trả lời nhanh, bằng lời của chính họ.", rating: 5, position: 1 },
        { name: "Tên khách hàng", role: "Nhà sáng tạo nội dung", body: "Một câu về việc số liệu giữ được sau vài tuần, nếu khách của bạn có nói vậy.", rating: 4, position: 2 },
      ]
    : [
        { name: "Customer name", role: "Online shop", body: "Replace this with something a real customer said. Name the service they bought and what it did for them.", rating: 5, position: 0 },
        { name: "Customer name", role: "Agency", body: "A line about delivery speed, or about support answering, in their own words.", rating: 5, position: 1 },
        { name: "Customer name", role: "Creator", body: "A line about the numbers holding up weeks later, if that is what your customers tell you.", rating: 4, position: 2 },
      ];
  // All or nothing, keyed on the table rather than on each row: a panel that
  // has one testimonial of its own has started writing them, and dropping
  // three templates in beside it would be the seed editing the operator's
  // page. Checking row by row did exactly that on a re-run.
  if ((await db.testimonial.count({ where: { panelId: PANEL } })) === 0) {
    for (const q of quotes) {
      await db.testimonial.create({ data: { ...q, visible: false, panelId: PANEL } });
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
