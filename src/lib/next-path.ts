/**
 * Where to go after signing in, when it can be trusted.
 *
 * A "next" parameter is an open redirect waiting to happen: the value arrives
 * from whoever wrote the link, and a panel that follows it blindly can be used
 * to bounce a customer from a URL they trust onto one they do not, with the
 * sign-in they just completed lending it credibility. So this is a whitelist
 * of shapes, not a blacklist of tricks.
 *
 * Only a path on this very site is allowed:
 *   - it starts with a single "/", which rules out "https://evil.test"
 *   - "//evil.test" is protocol-relative and is a different site
 *   - "/\evil.test" is the same trick with the slash some parsers accept
 *   - "/login" and its neighbours are refused, because bouncing back to the
 *     page that just succeeded is a loop rather than a destination
 */
const REFUSED = ["/login", "/register", "/two-factor", "/forgot-password", "/reset-password", "/verify-email"];

export function safeNext(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const path = value.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.startsWith("/\\")) return null;
  // A newline in a redirect target is how header splitting starts, and no
  // legitimate path has one.
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;
  if (REFUSED.some((refused) => path === refused || path.startsWith(`${refused}?`))) return null;

  return path;
}

/** The same, as a query string ready to append — empty when there is nothing. */
export function nextQuery(value: unknown): string {
  const path = safeNext(value);
  return path ? `?next=${encodeURIComponent(path)}` : "";
}
