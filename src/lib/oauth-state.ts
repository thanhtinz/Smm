/**
 * The scrap of state that survives the trip to the provider and back.
 *
 * It is a cookie rather than a row: it lives for ten minutes, belongs to one
 * browser, and a signed-out visitor has nothing in the database to hang it
 * off. `sameSite: "lax"` is the widest setting that still arrives — the
 * provider sends the browser back with a top-level GET, which lax allows and
 * strict does not.
 */
export const OAUTH_STATE_COOKIE = "nova_oauth";

const TEN_MINUTES = 600;

export function stateCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TEN_MINUTES,
  };
}

export type OAuthState = { token: string; provider: string; next: string };

/** Reads the cookie back, refusing anything that is not what we wrote. */
export function parseState(raw: string | undefined): OAuthState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<OAuthState>;
    if (typeof parsed.token !== "string" || parsed.token.length < 16) return null;
    if (typeof parsed.provider !== "string" || !parsed.provider) return null;
    return { token: parsed.token, provider: parsed.provider, next: typeof parsed.next === "string" ? parsed.next : "" };
  } catch {
    return null;
  }
}
