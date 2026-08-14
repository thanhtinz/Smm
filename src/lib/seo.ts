import { db } from "./db";
import { getSetting } from "./settings";
import { panelBaseUrl } from "./tenancy";

/**
 * What a search engine is allowed to see, and how it finds it.
 *
 * Everything here is per panel. A child panel is a different site on a
 * different hostname with a different catalogue, so one sitemap listing them
 * all would be one panel publishing another's pages.
 */

/**
 * Paths no crawler should follow.
 *
 * Not a security measure — robots.txt is a request, and the pages behind
 * these already refuse anyone without a session. It keeps a customer's
 * dashboard and the sign-in form out of search results, which is where
 * neither belongs.
 */
export const PRIVATE_PATHS = [
  "/admin",
  "/dashboard",
  "/api",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/resend-verification",
  "/two-factor",
];

export type SitemapEntry = { url: string; lastModified?: Date; priority?: number };

/**
 * Every public address this panel has.
 *
 * Built from the catalogue and the pages the operator published, so a panel
 * that sells nothing yet submits a short sitemap rather than a list of empty
 * pages — which is the difference between a thin site and a broken one.
 */
export async function publicUrls(): Promise<SitemapEntry[]> {
  const base = await panelBaseUrl();
  const at = (path: string) => `${base}${path}`;

  const [platforms, pages] = await Promise.all([
    db.platform.findMany({
      where: { visible: true, categories: { some: { services: { some: { enabled: true } } } } },
      orderBy: { position: "asc" },
      select: { slug: true },
    }),
    db.page.findMany({
      where: { published: true },
      orderBy: { position: "asc" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    { url: at("/"), priority: 1 },
    { url: at("/services"), priority: 0.9 },
    // One address per platform, because that is the page a person searching
    // for "buff follow tiktok" should land on rather than the whole catalogue.
    ...platforms.map((p) => ({ url: at(`/services/${p.slug}`), priority: 0.8 })),
    { url: at("/api-docs"), priority: 0.4 },
    ...pages.map((p) => ({ url: at(`/p/${p.slug}`), lastModified: p.updatedAt, priority: 0.5 })),
  ];
}

/** False while the panel is being set up, or when the operator says so. */
export async function isIndexable(): Promise<boolean> {
  return Boolean(await getSetting("seo.indexable"));
}

/**
 * Tells the IndexNow engines a page changed.
 *
 * An open protocol with no account and no quota: the key is a string the
 * panel serves at a well-known path, and that is the whole of the
 * authentication. Bing, Yandex, Seznam and Naver share submissions between
 * them. Google does not take part, and saying otherwise would be a lie the
 * operator only discovers months later.
 *
 * Never throws and never blocks the thing that called it. A page edit that
 * failed because a search engine was down would be absurd.
 */
export async function pingIndexNow(paths: string[]): Promise<{ sent: number; skipped: string }> {
  const key = String((await getSetting("seo.indexNowKey")) ?? "").trim();
  if (!key) return { sent: 0, skipped: "no key" };
  if (!(await isIndexable())) return { sent: 0, skipped: "not indexable" };
  if (!paths.length) return { sent: 0, skipped: "nothing to send" };

  const base = await panelBaseUrl();
  const host = new URL(base).hostname;
  // A crawler cannot fetch the key file from localhost, so submitting from a
  // development machine would only teach the engines to distrust the key.
  if (host === "localhost" || host === "127.0.0.1") return { sent: 0, skipped: "local host" };

  try {
    const res = await fetch("https://api.indexnow.org/IndexNow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${base}/${key}.txt`,
        urlList: paths.map((p) => (p.startsWith("http") ? p : `${base}${p}`)),
      }),
    });
    return { sent: res.ok ? paths.length : 0, skipped: res.ok ? "" : `HTTP ${res.status}` };
  } catch (e) {
    return { sent: 0, skipped: e instanceof Error ? e.message : String(e) };
  }
}
