import { describe, expect, it } from "vitest";
import {
  OAUTH_PROVIDERS,
  authorizeUrl,
  isProviderKey,
  isUsable,
  normaliseProfile,
  redirectUri,
  settingKeys,
  usernameFrom,
} from "./oauth";

/**
 * The failures worth guarding here are all silent ones.
 *
 * A missing `state` is a login CSRF. An unconfirmed address matched against an
 * existing account is one person signing in as another. A username derived
 * straight from an email is a row the registration form would have refused.
 * None of them throws; each just quietly works, wrongly.
 */

describe("isProviderKey", () => {
  it("accepts the providers this panel knows", () => {
    for (const key of OAUTH_PROVIDERS) expect(isProviderKey(key)).toBe(true);
  });

  it("refuses anything else, including the shapes a URL can carry", () => {
    for (const value of ["", "Google", "twitter", "../google", null, undefined, 7, {}]) {
      expect(isProviderKey(value)).toBe(false);
    }
  });
});

describe("isUsable", () => {
  it("is on only when it could actually complete", () => {
    expect(isUsable({ enabled: true, clientId: "id", clientSecret: "secret" })).toBe(true);
  });

  // Switched on with nothing filled in is a button that lands the customer on
  // an error page on somebody else's site.
  it("is off when switched on but not configured", () => {
    expect(isUsable({ enabled: true, clientId: "", clientSecret: "secret" })).toBe(false);
    expect(isUsable({ enabled: true, clientId: "id", clientSecret: "" })).toBe(false);
    expect(isUsable({ enabled: true, clientId: "   ", clientSecret: "  " })).toBe(false);
  });

  it("is off when configured but switched off", () => {
    expect(isUsable({ enabled: false, clientId: "id", clientSecret: "secret" })).toBe(false);
  });
});

describe("redirectUri", () => {
  it("hangs the callback off the panel's own origin", () => {
    expect(redirectUri("https://panel.test", "google")).toBe("https://panel.test/auth/oauth/google/callback");
  });

  // The origin arrives from panelBaseUrl(), and a trailing slash there would
  // produce a double slash the provider treats as a different URI entirely —
  // which fails at the provider, after the customer has already left.
  it("does not double the slash when the origin carries one", () => {
    expect(redirectUri("https://panel.test/", "facebook")).toBe("https://panel.test/auth/oauth/facebook/callback");
  });
});

describe("authorizeUrl", () => {
  const base = { clientId: "cid", redirectUri: "https://panel.test/cb", state: "s1" };

  it("sends the customer to the provider with everything it needs", () => {
    const url = new URL(authorizeUrl({ ...base, provider: "google", nonce: "n1" }));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("cid");
    expect(url.searchParams.get("redirect_uri")).toBe("https://panel.test/cb");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("s1");
    expect(url.searchParams.get("nonce")).toBe("n1");
    expect(url.searchParams.get("scope")).toContain("email");
  });

  it("always carries the state, which is the whole CSRF defence", () => {
    for (const provider of OAUTH_PROVIDERS) {
      const url = new URL(authorizeUrl({ ...base, provider }));
      expect(url.searchParams.get("state")).toBe("s1");
    }
  });

  it("asks Google which account rather than reusing whichever is open", () => {
    const url = new URL(authorizeUrl({ ...base, provider: "google" }));
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  it("escapes a redirect that carries a query of its own", () => {
    const url = new URL(
      authorizeUrl({ ...base, provider: "facebook", redirectUri: "https://panel.test/cb?a=1&b=2" }),
    );
    expect(url.searchParams.get("redirect_uri")).toBe("https://panel.test/cb?a=1&b=2");
  });
});

describe("normaliseProfile", () => {
  it("reads a Google answer", () => {
    expect(
      normaliseProfile("google", { sub: "1082", email: "Nova@Example.test", email_verified: true, name: "Nova" }),
    ).toEqual({ providerAccountId: "1082", email: "nova@example.test", emailVerified: true, name: "Nova" });
  });

  it("reads a Facebook answer", () => {
    expect(normaliseProfile("facebook", { id: "77", email: "a@b.test", name: "A" })).toMatchObject({
      providerAccountId: "77",
      email: "a@b.test",
      emailVerified: true,
    });
  });

  // The one that matters: an unverified address is a claim, and matching an
  // existing account on a claim lets anyone who can type an address sign in
  // as its owner.
  it("refuses a Google account whose address is not confirmed", () => {
    expect(normaliseProfile("google", { sub: "1", email: "victim@example.test", email_verified: false })).toBeNull();
    expect(normaliseProfile("google", { sub: "1", email: "victim@example.test" })).toBeNull();
  });

  it("refuses an answer with no stable id, which nothing could be linked to", () => {
    expect(normaliseProfile("google", { email: "a@b.test", email_verified: true })).toBeNull();
    expect(normaliseProfile("facebook", { id: "  ", email: "a@b.test" })).toBeNull();
  });

  it("refuses an answer with no usable address", () => {
    expect(normaliseProfile("facebook", { id: "1", name: "A" })).toBeNull();
    expect(normaliseProfile("facebook", { id: "1", email: "not-an-address" })).toBeNull();
  });

  it("refuses what is not an answer at all rather than throwing", () => {
    for (const raw of [null, undefined, "text", 7, []]) expect(normaliseProfile("google", raw)).toBeNull();
  });

  it("cuts a name to what the column holds", () => {
    const profile = normaliseProfile("google", {
      sub: "1",
      email: "a@b.test",
      email_verified: true,
      name: "x".repeat(400),
    });
    expect(profile?.name).toHaveLength(120);
  });
});

describe("usernameFrom", () => {
  const free = () => false;

  it("uses the part of the address before the @", () => {
    expect(usernameFrom("nova@example.test", free)).toBe("nova");
  });

  // These would each be refused by the registration form, so an account
  // created with one is a row the panel's own rules say cannot exist.
  it("keeps only the characters a username may contain", () => {
    expect(usernameFrom("nova.tran+smm@example.test", free)).toBe("novatransmm");
    expect(usernameFrom("NGUYỄN.an@example.test", free)).toMatch(/^[A-Za-z0-9_]+$/);
  });

  it("never returns anything shorter than three or longer than twenty-four", () => {
    for (const email of ["a@b.test", "..@b.test", "+@b.test", `${"z".repeat(90)}@b.test`]) {
      const name = usernameFrom(email, free);
      expect(name.length).toBeGreaterThanOrEqual(3);
      expect(name.length).toBeLessThanOrEqual(24);
      expect(name).toMatch(/^[A-Za-z0-9_]+$/);
    }
  });

  it("numbers a collision rather than failing or guessing", () => {
    const used = new Set(["nova", "nova2", "nova3"]);
    expect(usernameFrom("nova@example.test", (c) => used.has(c))).toBe("nova4");
  });

  it("stays within the limit when the suffix would push it over", () => {
    const long = "z".repeat(24);
    const name = usernameFrom(`${long}@b.test`, (c) => c === long);
    expect(name).toHaveLength(24);
    expect(name.endsWith("2")).toBe(true);
  });
});

describe("settingKeys", () => {
  it("names the three settings each provider is configured through", () => {
    expect(settingKeys("google")).toEqual({
      enabled: "oauth.googleEnabled",
      clientId: "oauth.googleClientId",
      clientSecret: "oauth.googleClientSecret",
    });
  });
});
