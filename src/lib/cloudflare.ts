import { getSetting } from "./settings";

/**
 * Cloudflare DNS for child panel hostnames.
 *
 * Only for hostnames inside a zone the panel operator owns. There the panel
 * can create the record itself, and asking the owner to prove they control a
 * domain the panel already controls would be theatre — so those hostnames go
 * live at once. Anything outside the zone keeps the TXT proof, which is the
 * only thing standing between a stranger and pointing their domain here.
 *
 * The token needs Zone.DNS Edit on one zone and nothing else.
 */

// Overridable so the client can be pointed at a local stand-in; the sandbox
// this was written in cannot reach Cloudflare.
const API = process.env.CLOUDFLARE_API ?? "https://api.cloudflare.com/client/v4";
const TIMEOUT_MS = 15_000;

export type CloudflareConfig = { token: string; zoneId: string };

export async function cloudflareConfig(): Promise<CloudflareConfig | null> {
  const token = String(await getSetting("panel.cloudflareToken")).trim();
  const zoneId = String(await getSetting("panel.cloudflareZoneId")).trim();
  return token && zoneId ? { token, zoneId } : null;
}

type Answer<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  config: CloudflareConfig,
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<Answer<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const json = (await res.json()) as {
      success?: boolean;
      result?: T;
      errors?: { message?: string }[];
    };

    // Cloudflare reports failures in the body as well as the status, and the
    // body is the one that says why.
    if (!json.success) {
      const reason = json.errors?.map((e) => e.message).filter(Boolean).join("; ");
      return { ok: false, error: reason || `Cloudflare returned HTTP ${res.status}` };
    }
    return { ok: true, data: json.result as T };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { ok: false, error: "Cloudflare timed out" };
    }
    return { ok: false, error: "Could not reach Cloudflare" };
  } finally {
    clearTimeout(timer);
  }
}

/** The apex the token's zone covers, e.g. `mypanel.com`. */
export async function zoneName(config: CloudflareConfig): Promise<Answer<string>> {
  const result = await call<{ name: string }>(config, `/zones/${config.zoneId}`);
  return result.ok ? { ok: true, data: result.data.name } : result;
}

/** Whether this hostname is one the zone can answer for. */
export function insideZone(host: string, zone: string): boolean {
  return host === zone || host.endsWith(`.${zone}`);
}

/**
 * Points a hostname at wherever this panel is served.
 *
 * A CNAME rather than an A record, so the address can change without every
 * child domain needing rewriting. Proxied, which is what puts the child
 * behind Cloudflare's certificate — a child panel on plain DNS would need
 * its own.
 */
export async function createRecord(
  config: CloudflareConfig,
  host: string,
  target: string,
): Promise<Answer<string>> {
  const result = await call<{ id: string }>(config, `/zones/${config.zoneId}/dns_records`, {
    method: "POST",
    body: { type: "CNAME", name: host, content: target, ttl: 1, proxied: true },
  });
  return result.ok ? { ok: true, data: result.data.id } : result;
}

/**
 * Removes a record the panel created.
 *
 * A record that is already gone counts as removed: the caller is deleting a
 * hostname, and refusing because the DNS side was tidied by hand first would
 * leave a row nobody can get rid of.
 */
export async function deleteRecord(config: CloudflareConfig, recordId: string): Promise<Answer<true>> {
  const result = await call<unknown>(config, `/zones/${config.zoneId}/dns_records/${recordId}`, {
    method: "DELETE",
  });
  if (result.ok) return { ok: true, data: true };
  return /not found|does not exist|81044/i.test(result.error) ? { ok: true, data: true } : result;
}
