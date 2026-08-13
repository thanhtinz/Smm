import { AsyncLocalStorage } from "node:async_hooks";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { Panel } from "@prisma/client";
import { basePrisma } from "./db-base";
import { PANEL_HOST_HEADER, normaliseHost } from "./panel-host";

export { PANEL_HOST_HEADER, normaliseHost };

/**
 * Explicit panel override.
 *
 * Ambient panel context normally comes from the request host, which is only
 * readable while a request is in flight. Cron runs, payment webhooks and the
 * wholesale hop between panels all act on behalf of a panel that is not the
 * one being served, so they wrap their work in `runAsPanel` and every query
 * underneath sees that panel instead.
 */
const override = new AsyncLocalStorage<{ panelId: string }>();

export function runAsPanel<T>(panelId: string, fn: () => Promise<T>): Promise<T> {
  // The await matters. Prisma promises are lazy — nothing runs until something
  // calls .then on them — so `run(store, fn)` where fn merely *returns* a query
  // would exit the store before the query ever starts, and the panel filter
  // would resolve against whatever context the caller happened to be in.
  // Awaiting here starts the query inside the store no matter how fn is written.
  return override.run({ panelId }, async () => await fn());
}

export function panelOverride(): string | null {
  return override.getStore()?.panelId ?? null;
}

const findPanel = cache(async (id: string) => basePrisma.panel.findUnique({ where: { id } }));

const findPanelByHost = cache(async (host: string) => {
  // Unverified hostnames are stored but never served: pointing a domain you do
  // not own at the panel should achieve nothing until the TXT record proves it.
  const domain = await basePrisma.panelDomain.findFirst({
    where: { host, verified: true },
    include: { panel: true },
  });
  return domain?.panel ?? null;
});

export const getRootPanel = cache(async () =>
  basePrisma.panel.findFirst({ where: { parentId: null }, orderBy: { createdAt: "asc" } }),
);

/**
 * The panel this request belongs to, or null when the host is not one we
 * serve. There is deliberately no fallback to the root panel: an unrecognised
 * host silently reading and writing the root tenant's rows is the quietest
 * way to lose data across panels.
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

/**
 * The panel every tenant-scoped query is filtered by. Fails closed: a caller
 * with no host and no override is a bug, and guessing a panel for it would
 * write one tenant's rows into another.
 */
export async function currentPanelId(): Promise<string> {
  const forced = panelOverride();
  if (forced) return forced;
  const panel = await getCurrentPanel();
  if (!panel) {
    throw new Error(
      "No panel in context. Requests resolve one from the host; background work must use runAsPanel().",
    );
  }
  return panel.id;
}

export async function requirePanel(): Promise<Panel> {
  const panel = await getCurrentPanel();
  if (!panel) throw new Error("UNKNOWN_PANEL_HOST");
  return panel;
}

/**
 * Page-side guard. Lives in the segment layouts rather than the root layout,
 * which is the one place React refuses to let `notFound()` run.
 */
export async function guardPanel(): Promise<Panel> {
  const panel = await getCurrentPanel();
  if (!panel) notFound();
  return panel;
}

/**
 * The public origin of the panel being served.
 *
 * Every panel lives on its own hostname, so a link built from a single APP_URL
 * env var would send a child panel's customers to the parent's domain. APP_URL
 * only decides the scheme and the port, which are the same for all of them.
 */
export async function panelBaseUrl(): Promise<string> {
  const fallback = process.env.APP_URL ?? "http://localhost:3000";
  const panel = await getCurrentPanel();
  if (!panel) return fallback;

  const domain =
    (await basePrisma.panelDomain.findFirst({
      where: { panelId: panel.id, verified: true },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    })) ?? null;
  if (!domain) return fallback;

  const template = new URL(fallback);
  template.hostname = domain.host;
  return template.origin;
}

/**
 * Reads one setting key across several panels at once.
 *
 * A deliberate cross-panel read: walking the ancestor chain one runAsPanel at
 * a time would be a query per level for a value the caller needs all of.
 */
export async function readSettingAcross(panelIds: string[], key: string): Promise<Map<string, string>> {
  if (panelIds.length === 0) return new Map();
  const rows = await basePrisma.setting.findMany({
    where: { panelId: { in: panelIds }, key },
    select: { panelId: true, value: true },
  });
  return new Map(rows.map((r) => [r.panelId, r.value]));
}
