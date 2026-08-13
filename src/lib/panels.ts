import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import type { Panel } from "@prisma/client";
import { db } from "./db";
import { readSettingAcross, runAsPanel } from "./tenancy";
import { nextPublicId } from "./ids";
import { setSetting, settingDefinitions } from "./settings";

/** Counters a fresh panel needs before it can number anything. */
const COUNTER_STARTS: Record<string, number> = {
  user: 1000,
  service: 1000,
  order: 100000,
  transaction: 100000,
  ticket: 1000,
  request: 1000,
};

const DEFAULT_PAGES = [
  { slug: "terms", title: "Terms of service", position: 0 },
  { slug: "privacy", title: "Privacy policy", position: 1 },
  { slug: "refund", title: "Refund policy", position: 2 },
];

/** The methods a new panel starts with, disabled until its owner adds keys. */
const DEFAULT_METHODS = [
  { code: "seapay", name: "Bank transfer (SePay)", driver: "seapay", icon: "bank", currencies: ["VND"] },
  { code: "paypal", name: "PayPal", driver: "paypal", icon: "paypal", currencies: ["USD", "EUR"] },
  { code: "link", name: "Card / Link", driver: "link", icon: "creditCard", currencies: ["USD", "EUR"] },
  { code: "manual_bank", name: "Manual bank transfer", driver: "manual", icon: "wallet", currencies: [] },
];

export type ChildDraft = {
  slug: string;
  name: string;
  host: string;
  ownerUserId: string;
  adminUsername: string;
  adminEmail: string;
  adminPassword: string;
};

/**
 * Creates a child panel underneath `parent` and everything it needs to serve
 * its first request: counters, branding, static pages, payment methods and an
 * admin account of its own.
 *
 * The owner keeps their account on the parent panel — that is the balance rent
 * and wholesale come out of. The admin account created here is a separate row
 * inside the child, because a User belongs to exactly one panel.
 */
export async function createChildPanel(parent: Panel, draft: ChildDraft): Promise<Panel> {
  const panel = await db.panel.create({
    data: {
      slug: draft.slug,
      name: draft.name,
      parentId: parent.id,
      depth: parent.depth + 1,
      path: "",
      ownerUserId: draft.ownerUserId,
    },
  });
  await db.panel.update({
    where: { id: panel.id },
    data: { path: `${parent.path}/${panel.id}` },
  });

  // A hostname under a domain the parent already proved it controls needs no
  // second proof — that is the usual case, a subdomain handed to a reseller.
  // Anything else has to publish the TXT record before it will be served.
  const parentHosts = await db.panelDomain.findMany({
    where: { panelId: parent.id, verified: true },
    select: { host: true },
  });
  const inherited = parentHosts.some((d) => draft.host.endsWith(`.${d.host}`));

  await db.panelDomain.create({
    data: {
      panelId: panel.id,
      host: draft.host,
      verified: inherited,
      isPrimary: true,
      verifyToken: randomBytes(12).toString("hex"),
    },
  });

  // Everything below is written as the new panel, so the panel filter in
  // src/lib/db.ts stamps it rather than each call repeating panelId.
  await runAsPanel(panel.id, async () => {
    for (const [name, value] of Object.entries(COUNTER_STARTS)) {
      await db.counter.create({ data: { name, value } });
    }

    await setSetting("site.name", draft.name);
    await setSetting("site.logoText", draft.name);

    for (const page of DEFAULT_PAGES) {
      await db.page.create({
        data: {
          slug: page.slug,
          title: page.title,
          body: "<p>Edit this page from Admin → Pages.</p>",
          position: page.position,
        },
      });
    }

    for (const [index, method] of DEFAULT_METHODS.entries()) {
      await db.paymentMethod.create({
        data: {
          code: method.code,
          name: method.name,
          driver: method.driver,
          icon: method.icon,
          enabled: false,
          currencies: JSON.stringify(method.currencies),
          position: index,
        },
      });
    }

    // A starting tier, so the panel prices coherently from its first customer
    // and its admin has something to clone rather than an empty page.
    await db.userTier.create({
      data: { name: "Standard", slug: "standard", discountPercent: 0, isDefault: true, color: "#94a3b8" },
    });

    await db.user.create({
      data: {
        publicId: await nextPublicId("user"),
        username: draft.adminUsername,
        email: draft.adminEmail,
        password: await bcrypt.hash(draft.adminPassword, 10),
        role: "admin",
        emailVerified: true,
      },
    });
  });

  return db.panel.findUniqueOrThrow({ where: { id: panel.id } });
}

/** Every panel at or below `panel`, itself included. */
export async function subtreeOf(panel: Panel) {
  return db.panel.findMany({
    where: { OR: [{ id: panel.id }, { path: { startsWith: `${panel.path}/` } }] },
    orderBy: [{ depth: "asc" }, { slug: "asc" }],
  });
}

/** Direct children only, with the counts the admin list shows. */
export async function childrenOf(panel: Panel) {
  const children = await db.panel.findMany({
    where: { parentId: panel.id },
    include: { domains: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] } },
    orderBy: { createdAt: "desc" },
  });

  // Counted inside runAsPanel: the filter overrides any panelId passed in a
  // where clause, so asking about another panel means becoming it briefly.
  return Promise.all(
    children.map(async (child) => ({
      ...child,
      ...(await runAsPanel(child.id, async () => ({
        users: await db.user.count(),
        orders: await db.order.count(),
        services: await db.service.count(),
      }))),
    })),
  );
}

/**
 * The deepest level any panel below `panel` may reach.
 *
 * Each panel has its own `panel.maxDepth`, but a child setting its own limit
 * could otherwise undo its parent's. The effective cap is the strictest
 * non-zero value anywhere up the chain, so a limit set at the root binds
 * everything beneath it. Zero means unlimited at that level.
 */
export async function effectiveMaxDepth(panel: Panel): Promise<number> {
  const ancestorIds = panel.path.split("/").filter(Boolean);
  const stored = await readSettingAcross(ancestorIds, "panel.maxDepth");

  const values = [...stored.values()]
    .map((raw) => {
      try {
        return Number(JSON.parse(raw));
      } catch {
        return 0;
      }
    })
    .filter((n) => Number.isFinite(n) && n > 0);

  // No row anywhere means every panel is on the registry default.
  if (values.length === 0) return Number(settingDefinitions["panel.maxDepth"].value) || 0;
  return Math.min(...values);
}
