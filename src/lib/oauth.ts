/**
 * Signing in with an account somebody already has.
 *
 * Email and password is the only way in today, and asking a buyer to invent a
 * twelfth password before they can spend money is where a good many of them
 * stop. Google and Facebook cover almost everyone in this market.
 *
 * What lives here is every rule that can be got wrong without the network
 * noticing: what a provider's answer means, what a username derived from a
 * stranger's email is allowed to look like, and which redirect targets are
 * this site rather than somebody else's. The endpoints are in code because
 * they are part of what "Google" means, not something an operator would ever
 * choose; everything an operator *does* choose — whether it is on at all, the
 * client id, the secret — is a setting in the admin area.
 */

export const OAUTH_PROVIDERS = ["google", "facebook"] as const;
export type OAuthProviderKey = (typeof OAUTH_PROVIDERS)[number];

export type OAuthEndpoints = {
  authorizeUrl: string;
  tokenUrl: string;
  profileUrl: string;
  scope: string;
};

export const OAUTH_ENDPOINTS: Record<OAuthProviderKey, OAuthEndpoints> = {
  google: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://openidconnect.googleapis.com/v1/userinfo",
    scope: "openid email profile",
  },
  facebook: {
    authorizeUrl: "https://www.facebook.com/v21.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v21.0/oauth/access_token",
    profileUrl: "https://graph.facebook.com/v21.0/me?fields=id,name,email",
    scope: "email public_profile",
  },
};

/** Whether a string names a provider this panel knows how to talk to. */
export function isProviderKey(value: unknown): value is OAuthProviderKey {
  return typeof value === "string" && (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

/** The settings keys a provider is configured through. */
export function settingKeys<P extends OAuthProviderKey>(provider: P) {
  return {
    enabled: `oauth.${provider}Enabled` as const,
    clientId: `oauth.${provider}ClientId` as const,
    clientSecret: `oauth.${provider}ClientSecret` as const,
  };
}

/**
 * A provider is offered only when it can actually complete.
 *
 * Switched on with no client id is a button that takes a customer to an error
 * page on somebody else's site, which is worse than no button.
 */
export function isUsable(config: { enabled: unknown; clientId: unknown; clientSecret: unknown }): boolean {
  return (
    Boolean(config.enabled) &&
    String(config.clientId ?? "").trim() !== "" &&
    String(config.clientSecret ?? "").trim() !== ""
  );
}

/** Where this panel's callback lives, for one provider. */
export function redirectUri(origin: string, provider: OAuthProviderKey): string {
  return `${origin.replace(/\/+$/, "")}/auth/oauth/${provider}/callback`;
}

/**
 * The address the customer's browser is sent to.
 *
 * `state` is the only thing standing between this and a login CSRF — an
 * attacker completing the dance with their own account and handing the
 * finished callback to a victim — so it is required rather than optional.
 */
export function authorizeUrl(args: {
  provider: OAuthProviderKey;
  clientId: string;
  redirectUri: string;
  state: string;
  nonce?: string;
}): string {
  const endpoints = OAUTH_ENDPOINTS[args.provider];
  const url = new URL(endpoints.authorizeUrl);
  url.searchParams.set("client_id", args.clientId);
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", endpoints.scope);
  url.searchParams.set("state", args.state);
  if (args.provider === "google") {
    // Ask for the account chooser rather than silently reusing whichever
    // Google session the browser happens to hold.
    url.searchParams.set("prompt", "select_account");
    if (args.nonce) url.searchParams.set("nonce", args.nonce);
  }
  return url.toString();
}

export type OAuthProfile = {
  /** The provider's own permanent id for the account. */
  providerAccountId: string;
  email: string;
  /** Whether the provider says it has confirmed the address. */
  emailVerified: boolean;
  name: string;
};

/**
 * What a provider told us about the person, in one shape.
 *
 * Anything without a stable id or a confirmed address is refused: an
 * unconfirmed address is a claim, and matching an existing account on a claim
 * is how one person signs in as another.
 */
export function normaliseProfile(provider: OAuthProviderKey, raw: unknown): OAuthProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;

  const providerAccountId = String((provider === "google" ? row.sub : row.id) ?? "").trim();
  if (!providerAccountId) return null;

  const email = String(row.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) return null;

  // Google says so explicitly. Facebook returns an address only once it has
  // been confirmed on their side and has no field for it, so its presence is
  // the statement.
  const emailVerified = provider === "google" ? row.email_verified === true || row.email_verified === "true" : true;
  if (!emailVerified) return null;

  return {
    providerAccountId,
    email,
    emailVerified,
    name: String(row.name ?? "").trim().slice(0, 120),
  };
}

/**
 * A username for somebody who never chose one.
 *
 * It has to satisfy the same rule the registration form enforces — 3 to 24 of
 * [A-Za-z0-9_] — because these accounts are not a separate kind of account.
 * `taken` decides collisions, so the caller can answer from the database
 * without this function needing one.
 */
export function usernameFrom(email: string, taken: (candidate: string) => boolean): string {
  const local = email.split("@")[0] ?? "";
  let base = local.replace(/[^A-Za-z0-9_]+/g, "").slice(0, 24);
  // Nothing usable survived — an address that is entirely dots and dashes.
  if (base.length < 3) base = `user${base}`.slice(0, 24);
  while (base.length < 3) base += "0";

  if (!taken(base)) return base;

  // Numbered rather than random, so a person can read their own name in it.
  for (let n = 2; n < 10_000; n += 1) {
    const suffix = String(n);
    const candidate = `${base.slice(0, 24 - suffix.length)}${suffix}`;
    if (!taken(candidate)) return candidate;
  }

  // Ten thousand collisions on one local-part is not a real panel, but a
  // caller that gets here must still be handed something legal.
  return `user${Date.now().toString(36)}`.slice(0, 24);
}
