import { createHmac, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { db } from "./db";
import { basePrisma } from "./db-base";
import { runAsPanel } from "./tenancy";
import { getSetting } from "./settings";

// Re-exported so the queue and its delivery stay one thing to import from,
// even though only one half of them can be reached from a client bundle.
export { queueCallback, type QueueClient, type CallbackBody } from "./callbacks/queue";

/**
 * Telling a reseller their order is finished.
 *
 * A reseller runs their own shop on top of this panel and has their own
 * customer waiting. Without this their only option is to call `status` in a
 * loop — wasted work for both sides, and their customer waits out the polling
 * interval on top of the delivery.
 *
 * The queue is a table, not a fetch at the moment the order settles, because
 * their server will be down sometimes and that is exactly when the message
 * matters. Rows are written inside the same transaction as the status change,
 * so there is no window where the order is completed and nothing is queued.
 */

const TIMEOUT_MS = 10_000;

/**
 * HMAC-SHA256 over the exact bytes sent, keyed by the reseller's API key.
 *
 * Their API key is already the secret that authenticates them to this panel,
 * so it needs no second one to remember. Signing the raw body rather than the
 * parsed fields is what lets them verify without agreeing on how to serialise
 * — the bytes they hash are the bytes on the wire.
 */
export function signCallback(body: string, apiKey: string): string {
  return createHmac("sha256", apiKey).update(body).digest("hex");
}

/** For the documentation, and for anyone verifying the example. */
export function verifyCallback(body: string, apiKey: string, signature: string): boolean {
  const expected = Buffer.from(signCallback(body, apiKey), "utf8");
  const given = Buffer.from(signature, "utf8");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

/**
 * Whether the panel is willing to make a request to this address.
 *
 * A callback URL is typed by a customer, and the request goes out from the
 * panel's own server — so an unchecked one turns every reseller account into a
 * way to reach whatever that server can reach: a metadata endpoint on a cloud
 * host, a database on localhost, anything else on the private network. The
 * check is on the resolved address rather than the hostname, because a name
 * the attacker controls can be pointed at 127.0.0.1 whenever they like.
 *
 * A panel that genuinely needs to call something on its own network can turn
 * this off, but it is on by default: the safe answer has to be the one nobody
 * has to know to choose.
 */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    // ::, ::1, link-local, unique-local. A v4-mapped address is unwrapped and
    // judged as v4 rather than waved through.
    if (v6 === "::" || v6 === "::1") return true;
    if (v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb")) return true;
    if (v6.startsWith("fc") || v6.startsWith("fd")) return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
    if (mapped) return isPrivateAddress(mapped[1]);
    return false;
  }

  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n))) return true;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // link-local, and cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // carrier-grade NAT
  if (a >= 224) return true; // multicast and reserved
  return false;
}

export type UrlCheck = { ok: true; url: URL; addresses?: string[] } | { ok: false; reason: string };

/**
 * Shape only: is this a URL this panel could POST to at all?
 *
 * Deliberately says nothing about where the address points. That question is
 * the operator's to switch off, and mixing the two here would make the setting
 * a half-measure that still refused a literal 10.0.0.5.
 */
export function checkCallbackUrl(raw: string): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "notUrl" };
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return { ok: false, reason: "scheme" };
  if (url.username || url.password) return { ok: false, reason: "credentials" };
  return { ok: true, url };
}

/** Where it points, without asking the network. */
export function pointsSomewherePrivate(url: URL): boolean {
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return isPrivateAddress(host);
  // Names that mean loopback by convention, before DNS is even asked.
  return host === "localhost" || host.endsWith(".localhost");
}

/**
 * The whole check: shape, then — unless the operator has switched it off —
 * where the address actually leads, DNS included.
 */
export async function resolveCallbackUrl(raw: string): Promise<UrlCheck> {
  const shape = checkCallbackUrl(raw);
  if (!shape.ok) return shape;
  if (!(await getSetting("api.callbackBlockPrivate"))) return shape;

  if (pointsSomewherePrivate(shape.url)) return { ok: false, reason: "private" };

  const host = shape.url.hostname.replace(/^\[|\]$/g, "");
  // A literal address was already judged; only a name still needs resolving.
  if (isIP(host)) return shape;

  try {
    const addresses = await lookup(host, { all: true });
    if (addresses.length === 0) return { ok: false, reason: "unresolved" };
    // Every answer has to be public: one private record among them is enough
    // to reach the private address.
    if (addresses.some((a) => isPrivateAddress(a.address))) return { ok: false, reason: "private" };
    // Handed back so the request can be made to the address that was judged.
    // Resolving twice — once to check, once to connect — leaves a window where
    // a reseller who runs their own DNS answers publicly for the check and
    // 169.254.169.254 for the connection.
    return { ok: true, url: shape.url, addresses: addresses.map((a) => a.address) };
  } catch {
    return { ok: false, reason: "unresolved" };
  }
}

/**
 * POST the signed body, connecting only to an address the check approved.
 *
 * `fetch` resolves the name itself and gives no way to say which address it
 * may use, so this drops to the request underneath it, where `lookup` is a
 * parameter. The hostname still travels in the Host header and in the TLS
 * handshake, so a certificate is verified against the name the reseller gave,
 * not against the address it landed on.
 *
 * Redirects are not followed here either — nothing in `http.request` follows
 * them — which keeps the second address a redirect would introduce out of it.
 */
async function postToCheckedAddress(
  url: URL,
  addresses: string[] | undefined,
  headers: Record<string, string>,
  body: string,
): Promise<number> {
  const { request } = url.protocol === "https:" ? await import("node:https") : await import("node:http");
  const pinned = addresses?.[0];

  return new Promise<number>((resolve, reject) => {
    const req = request(
      url,
      {
        method: "POST",
        headers: { ...headers, "Content-Length": String(Buffer.byteLength(body)) },
        ...(pinned
          ? {
              lookup: (
                _host: string,
                _options: unknown,
                cb: (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void,
              ) => {
                const family = isIP(pinned);
                const all = (_options as { all?: boolean } | undefined)?.all;
                if (all) cb(null, [{ address: pinned, family }]);
                else cb(null, pinned, family);
              },
            }
          : {}),
      },
      (res) => {
        // Nothing here reads the body, and an unread response holds the
        // socket open until the timeout.
        res.resume();
        resolve(res.statusCode ?? 0);
      },
    );

    req.setTimeout(TIMEOUT_MS, () => req.destroy(Object.assign(new Error("Timed out"), { name: "AbortError" })));
    req.on("error", reject);
    req.end(body);
  });
}

/** Doubling, from one minute: 1, 2, 4, 8, 16, 32… */
function backoffMinutes(attempt: number): number {
  return Math.min(2 ** (attempt - 1), 60);
}

export type DeliveryReport = { sent: number; failed: number; retrying: number };

/**
 * One delivery pass, for every panel.
 *
 * Runs unscoped by design: the queue crosses panels and the scheduler has no
 * host to resolve one from, so each row is delivered inside its own panel's
 * scope only where it needs the panel's settings.
 */
export async function deliverCallbacks(limit = 50): Promise<DeliveryReport> {
  const due = await basePrisma.callback.findMany({
    where: { status: "pending", nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    include: { user: { select: { apiKey: true, callbackUrl: true } } },
  });

  const report: DeliveryReport = { sent: 0, failed: 0, retrying: 0 };

  for (const row of due) {
    // Checked here rather than at queue time: switching callbacks off should
    // stop them now, not from the next order onwards. Rows keep accumulating
    // while it is off, which is what makes turning it back on recoverable.
    if (!(await runAsPanel(row.panelId, () => getSetting("api.callbacksEnabled")))) continue;

    const maxAttempts = Number(await runAsPanel(row.panelId, () => getSetting("api.callbackAttempts"))) || 6;
    const attempts = row.attempts + 1;

    // Read at send time rather than copied at queue time: a reseller who fixes
    // a typo should not have to wait for the next order to see it work.
    const target = row.user.callbackUrl;
    let code = 0;
    let error = "";

    if (!target) {
      error = "No callback URL set";
    } else {
      const checked = await runAsPanel(row.panelId, () => resolveCallbackUrl(target));
      if (!checked.ok) {
        error = `Refused to call ${target}: ${checked.reason}`;
      } else {
        try {
          code = await postToCheckedAddress(
            checked.url,
            checked.addresses,
            {
              "Content-Type": "application/json",
              "X-Signature": signCallback(row.payload, row.user.apiKey),
              "X-Order-Id": String(row.publicId),
            },
            row.payload,
          );
          // A redirect is not followed: the address that passed the private
          // check is the only one this request is allowed to reach.
          if (code >= 300 && code < 400) error = "Redirect not followed";
          else if (code < 200 || code >= 300) error = `HTTP ${code}`;
        } catch (e) {
          error = e instanceof Error && e.name === "AbortError" ? "Timed out" : "Could not be reached";
        }
      }
    }

    if (!error) {
      await basePrisma.callback.update({
        where: { id: row.id },
        data: { status: "delivered", attempts, lastCode: code, lastError: "", deliveredAt: new Date() },
      });
      report.sent += 1;
      continue;
    }

    const giveUp = attempts >= maxAttempts;
    await basePrisma.callback.update({
      where: { id: row.id },
      data: {
        status: giveUp ? "failed" : "pending",
        attempts,
        lastCode: code,
        lastError: error,
        nextAttemptAt: new Date(Date.now() + backoffMinutes(attempts) * 60_000),
      },
    });
    if (giveUp) report.failed += 1;
    else report.retrying += 1;
  }

  return report;
}

/** The reseller's own recent deliveries, newest first. */
export async function recentCallbacks(userId: string, take = 10) {
  return db.callback.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take });
}
