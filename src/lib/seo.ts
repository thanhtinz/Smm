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
 * The catalogue is not among them: it lives inside the panel, where a reader
 * has to sign in. Listing an address a visitor cannot open is worse than not
 * listing it.
 */
export async function publicUrls(): Promise<SitemapEntry[]> {
  const base = await panelBaseUrl();
  const at = (path: string) => `${base}${path}`;

  // The catalogue is not public any more, so the map is the landing page, the
  // API documentation and whatever pages the operator wrote. Short on purpose:
  // listing an address a visitor cannot open is worse than not listing it.
  const [pages, posts] = await Promise.all([
    db.page.findMany({
      where: { published: true },
      orderBy: { position: "asc" },
      select: { slug: true, updatedAt: true },
    }),
    // Published and already due. A post dated for next week 404s, and a
    // sitemap that lists one is telling a crawler an address is broken.
    db.blogPost.findMany({
      where: { publishedAt: { not: null, lte: new Date() } },
      orderBy: { publishedAt: "desc" },
      select: { slug: true, updatedAt: true },
    }),
  ]);

  return [
    { url: at("/"), priority: 1 },
    { url: at("/api-docs"), priority: 0.4 },
    ...pages.map((p) => ({ url: at(`/p/${p.slug}`), lastModified: p.updatedAt, priority: 0.5 })),
    // The index only once there is something under it: an empty page in a
    // sitemap is a page a crawler learns to stop fetching.
    ...(posts.length > 0 ? [{ url: at("/blog"), priority: 0.6 }] : []),
    ...posts.map((p) => ({ url: at(`/blog/${p.slug}`), lastModified: p.updatedAt, priority: 0.6 })),
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
