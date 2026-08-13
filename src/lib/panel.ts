import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { cache } from "react";
import type { Panel } from "@prisma/client";
import { db } from "./db";
import { PANEL_HOST_HEADER, normaliseHost } from "./panel-host";

export { PANEL_HOST_HEADER, normaliseHost };

/**
 * Explicit panel override.
 *
 * Ambient panel context normally comes from the request host, which is only
 * readable while a request is in flight. Cron runs, payment webhooks and the
 * internal wholesale hop all act on behalf of a panel that is not the one
 * being served, so they wrap their work in `runAsPanel` and every lookup
 * underneath sees that panel instead.
 */
const override = new AsyncLocalStorage<{ panelId: string }>();

export function runAsPanel<T>(panelId: string, fn: () => Promise<T>): Promise<T> {
  return override.run({ panelId }, fn);
}

export function panelOverride(): string | null {
  return override.getStore()?.panelId ?? null;
}

const findPanel = cache(async (id: string) => db.panel.findUnique({ where: { id } }));

const findPanelByHost = cache(async (host: string) => {
  const domain = await db.panelDomain.findUnique({ where: { host }, include: { panel: true } });
  return domain?.panel ?? null;
});

export const getRootPanel = cache(async () =>
  db.panel.findFirst({ where: { parentId: null }, orderBy: { createdAt: "asc" } }),
);

/**
 * The panel this request belongs to, or null when the host is not one we
 * serve. There is deliberately no fallback to the root panel: an unrecognised
 * host silently writing into the root tenant is the quietest way to lose data
 * across panels.
 */
export async function getCurrentPanel(): Promise<Panel | null> {
  const forced = panelOverride();
  if (forced) return findPanel(forced);

  let host = "";
  try {
    const h = await headers();
    host = normaliseHost(h.get(PANEL_HOST_HEADER) ?? h.get("host") ?? "");
  } catch {
    // Outside a request (a script, a build-time render) there is no host to
    // read; callers there are expected to use runAsPanel.
    return null;
  }
  if (!host) return null;
  return findPanelByHost(host);
}

export async function requirePanel(): Promise<Panel> {
  const panel = await getCurrentPanel();
  if (!panel) throw new Error("UNKNOWN_PANEL_HOST");
  return panel;
}

/**
 * Creates the root panel if it is missing and attaches the hosts it answers
 * on. Safe to call repeatedly — used by the seed and by first boot.
 */
export async function ensureRootPanel(hosts: string[] = []): Promise<Panel> {
  const existing = await db.panel.findFirst({ where: { parentId: null }, orderBy: { createdAt: "asc" } });
  const panel =
    existing ??
    (await db.panel.create({
      data: { slug: "root", name: "Root panel", depth: 0, path: "" },
    }));

  if (!panel.path) {
    await db.panel.update({ where: { id: panel.id }, data: { path: panel.id } });
    panel.path = panel.id;
  }

  const wanted = [...new Set(hosts.map(normaliseHost).filter(Boolean))];
  for (const [index, host] of wanted.entries()) {
    await db.panelDomain.upsert({
      where: { host },
      create: { panelId: panel.id, host, verified: true, isPrimary: index === 0 },
      update: { panelId: panel.id, verified: true },
    });
  }

  return panel;
}
