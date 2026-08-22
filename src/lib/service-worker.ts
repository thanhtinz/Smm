import { readFile } from "fs/promises";
import { join } from "path";
import { OFFLINE_PATH } from "./pwa";

/**
 * The service worker, as source.
 *
 * It is written out here rather than shipped as a file in public/ for the same
 * reason the manifest is a route: the cache name has to change when the build
 * does, and a static file cannot know the build it is being served from.
 *
 * What it will and will not do is the whole design, so it is worth stating
 * plainly. A panel is signed-in, per-panel, per-currency and per-language;
 * almost every byte it sends depends on who asked. So **no HTML is ever put in
 * the cache**. The only things cached are the build's own hashed assets, which
 * are public and immutable, and one offline page that says the connection is
 * gone. Navigations go to the network and fall back to that page. Anything
 * under /api, any request that is not a GET, and anything cross-origin is not
 * touched at all.
 *
 * The alternative — caching pages so the app opens instantly offline — would
 * mean a support agent's ticket queue, or one customer's balance, sitting in a
 * cache that the next person to sign in on that device could be served from.
 * An SMM panel is not worth that.
 */
export function serviceWorkerSource(version: string): string {
  const cache = `nova-${version}`;

  return `// Generated per build by src/lib/service-worker.ts — do not edit in place.
const CACHE = ${JSON.stringify(cache)};
const OFFLINE = ${JSON.stringify(OFFLINE_PATH)};

// Public, immutable, and the same for every reader. Nothing else is cacheable
// on a panel where the response depends on who is signed in.
const CACHE_FIRST = [/^\\/_next\\/static\\//, /^\\/platforms\\//, /^\\/icon\\.svg$/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll([OFFLINE])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      // Every build gets its own cache, so the old one is dropped whole rather
      // than left to age out entry by entry.
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("nova-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// A page that has just been told the panel no longer wants a worker asks for
// this, so an operator turning the switch off reaches devices that already
// have one rather than only new visitors.
self.addEventListener("message", (event) => {
  if (event.data === "nova-uninstall") {
    event.waitUntil(
      caches
        .keys()
        .then((keys) => Promise.all(keys.filter((k) => k.startsWith("nova-")).map((k) => caches.delete(k))))
        .then(() => self.registration.unregister()),
    );
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never: these answer differently per reader, or per moment.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/_next/image")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      // Network first, always. The cache holds one page and it is the one that
      // says the network is gone; serving it while the network works would be
      // the panel lying about its own state.
      fetch(request).catch(() => caches.match(OFFLINE).then((hit) => hit || Response.error())),
    );
    return;
  }

  if (!CACHE_FIRST.some((re) => re.test(url.pathname))) return;

  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          // Only a clean answer is worth keeping. A 404 or a redirect cached
          // here would outlive the deploy that caused it.
          if (response.ok && response.type === "basic") {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
`;
}

/**
 * What names this build's cache.
 *
 * The build id, which Next writes next to the compiled output and changes on
 * every build. In development there is no such file and no such thing as a
 * build, so the worker gets one stable name and keeps re-fetching what it is
 * told not to cache anyway.
 */
export async function buildVersion(): Promise<string> {
  try {
    const id = await readFile(join(process.cwd(), ".next", "BUILD_ID"), "utf8");
    return id.trim() || "dev";
  } catch {
    return "dev";
  }
}
