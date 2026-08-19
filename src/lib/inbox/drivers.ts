import { timingSafeEqual } from "node:crypto";
import { metaChallenge, metaGraphBase, parseMetaMessaging, verifyMetaSignature } from "./meta";
import { parseZaloWebhook, verifyZaloSignature, zaloApiBase } from "./zalo";

/**
 * Messaging channels.
 *
 * Every platform in this space works the same way from the panel's side: a
 * webhook brings messages in, an HTTP call sends them out, and a credential
 * check tells the operator whether what they pasted works. A driver is those
 * three functions, so the inbox itself never mentions a platform by name.
 */

export type IncomingMessage = {
  /** The account this arrived at, so one webhook address serves every channel. */
  accountId: string;
  /** The thread on that account — chat id, PSID, user id. */
  threadId: string;
  /** The platform's message id, which is what makes redelivery harmless. */
  externalId: string;
  body: string;
  contactName: string;
  contactHandle: string;
};

export type CheckResult =
  | { ok: true; externalId: string; name: string }
  | { ok: false; error: string };

/** Whether the platform accepted the address it was given. */
export type RegisterResult = { ok: true } | { ok: false; error: string };

export type ChannelDriver = {
  kind: string;
  /** Fields the connect form asks for. Secrets are never read back. */
  fields: { key: string; secret?: boolean }[];
  /** Confirms the credentials work and returns who they belong to. */
  check(config: Record<string, string>): Promise<CheckResult>;
  /** Turns one webhook body into zero or more messages. */
  parse(payload: unknown): IncomingMessage[];
  /** Sends a reply; returns the platform's id for it when it gives one. */
  send(config: Record<string, string>, threadId: string, body: string): Promise<{ externalId?: string }>;

  /**
   * Tells the platform where to post, and gives it a secret to post with.
   *
   * Registering and verifying are one decision, not two: the secret is only
   * worth checking on the way in because it was handed over on the way out.
   * A driver for a platform that signs its own payloads implements `verify`
   * alone and leaves this out.
   */
  register?(config: Record<string, string>, url: string, secret: string): Promise<RegisterResult>;

  /**
   * Whether this request really came from the platform.
   *
   * The URL alone is not proof. It contains the panel's webhook token and the
   * channel's id, both of which are addresses rather than credentials — they
   * appear in an admin page, in a browser history, in whatever the operator
   * pasted them into. Anyone holding them could otherwise post messages into
   * the inbox as any customer.
   */
  verify?(config: Record<string, string>, request: Request, secret: string, rawBody?: string): boolean;

  /** Meta-style subscription verification (GET hub.challenge). */
  challenge?(request: Request, config: Record<string, string>): string | null;
};

/** Constant-time, and length-safe: timingSafeEqual throws on a mismatch. */
function secretMatches(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Telegram.
 *
 * Chosen as the first driver because it is the one that can be verified
 * end to end without a business account, an app review or a signed contract:
 * a bot token is issued in a minute and the API is one HTTPS call each way.
 */
const telegram: ChannelDriver = {
  kind: "telegram",
  fields: [{ key: "token", secret: true }],

  async check(config) {
    try {
      const res = await fetch(`${apiBase(config)}/getMe`);
      const data = (await res.json()) as { ok?: boolean; result?: { id?: number; username?: string; first_name?: string }; description?: string };
      if (!data.ok || !data.result?.id) return { ok: false, error: data.description ?? "getMe failed" };
      return {
        ok: true,
        externalId: String(data.result.id),
        name: data.result.username ? `@${data.result.username}` : (data.result.first_name ?? "bot"),
      };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  parse(payload) {
    const update = payload as {
      message?: {
        message_id?: number;
        text?: string;
        chat?: { id?: number };
        from?: { id?: number; username?: string; first_name?: string; last_name?: string };
      };
    };
    const message = update.message;
    // Edits, joins, stickers and everything else are ignored rather than
    // stored as blank rows the team would have to open to discover are empty.
    if (!message?.text || !message.chat?.id || message.message_id === undefined) return [];

    const from = message.from ?? {};
    const name = [from.first_name, from.last_name].filter(Boolean).join(" ");
    return [
      {
        // Telegram's webhook does not name the bot, so the address does: the
        // channel is chosen by the path, not the payload.
        accountId: "",
        threadId: String(message.chat.id),
        externalId: String(message.message_id),
        body: message.text,
        contactName: name || from.username || String(from.id ?? ""),
        contactHandle: from.username ? `@${from.username}` : "",
      },
    ];
  },

  /**
   * Telegram delivers to whatever address setWebhook was last given, and will
   * send `secret_token` back in a header on every delivery. One call does
   * both, so the address and the secret can never disagree.
   */
  async register(config, url, secret) {
    try {
      const res = await fetch(`${apiBase(config)}/setWebhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only messages: the panel ignores edits, joins and the rest, and
        // asking for them is bandwidth spent to drop them.
        body: JSON.stringify({ url, secret_token: secret, allowed_updates: ["message"] }),
      });
      const data = (await res.json()) as { ok?: boolean; description?: string };
      return data.ok ? { ok: true } : { ok: false, error: data.description ?? "setWebhook failed" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  verify(_config, request, secret) {
    return secretMatches(secret, request.headers.get("x-telegram-bot-api-secret-token") ?? "");
  },

  async send(config, threadId, body) {
    const res = await fetch(`${apiBase(config)}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: threadId, text: body }),
    });
    const data = (await res.json()) as { ok?: boolean; result?: { message_id?: number }; description?: string };
    if (!data.ok) throw new Error(data.description ?? "sendMessage failed");
    return { externalId: data.result?.message_id === undefined ? undefined : String(data.result.message_id) };
  },
};

/**
 * The API root.
 *
 * Overridable so the driver can be pointed at a local stand-in and tested for
 * real; left alone it is Telegram's own host.
 */
function apiBase(config: Record<string, string>): string {
  const base = (config.apiBase || "https://api.telegram.org").replace(/\/+$/, "");
  return `${base}/bot${config.token}`;
}

const messenger: ChannelDriver = {
  kind: "messenger",
  fields: [
    { key: "pageAccessToken", secret: true },
    { key: "appSecret", secret: true },
    { key: "verifyToken", secret: true },
  ],

  async check(config) {
    try {
      const res = await fetch(`${metaGraphBase(config)}/me?fields=id,name&access_token=${encodeURIComponent(config.pageAccessToken)}`);
      const data = (await res.json()) as { id?: string; name?: string; error?: { message?: string } };
      if (!data.id) return { ok: false, error: data.error?.message ?? "Graph API rejected the page token" };
      return { ok: true, externalId: data.id, name: data.name ?? "Page" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  parse(payload) {
    return parseMetaMessaging(payload);
  },

  challenge(request, config) {
    return metaChallenge(request, config.verifyToken);
  },

  verify(config, _request, _secret, rawBody = "") {
    return verifyMetaSignature(config.appSecret, rawBody, _request.headers.get("x-hub-signature-256"));
  },

  async send(config, threadId, body) {
    const res = await fetch(`${metaGraphBase(config)}/me/messages?access_token=${encodeURIComponent(config.pageAccessToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: threadId }, message: { text: body } }),
    });
    const data = (await res.json()) as { message_id?: string; error?: { message?: string } };
    if (!data.message_id) throw new Error(data.error?.message ?? "send failed");
    return { externalId: data.message_id };
  },
};

const instagram: ChannelDriver = {
  kind: "instagram",
  fields: [
    { key: "pageAccessToken", secret: true },
    { key: "appSecret", secret: true },
    { key: "verifyToken", secret: true },
  ],

  async check(config) {
    try {
      const res = await fetch(
        `${metaGraphBase(config)}/me?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(config.pageAccessToken)}`,
      );
      const data = (await res.json()) as {
        instagram_business_account?: { id?: string; username?: string };
        error?: { message?: string };
      };
      const ig = data.instagram_business_account;
      if (!ig?.id) return { ok: false, error: data.error?.message ?? "No Instagram business account on this page" };
      return { ok: true, externalId: ig.id, name: ig.username ? `@${ig.username}` : "Instagram" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  parse(payload) {
    return parseMetaMessaging(payload);
  },

  challenge(request, config) {
    return metaChallenge(request, config.verifyToken);
  },

  verify(config, request, _secret, rawBody = "") {
    return verifyMetaSignature(config.appSecret, rawBody, request.headers.get("x-hub-signature-256"));
  },

  async send(config, threadId, body) {
    const res = await fetch(`${metaGraphBase(config)}/me/messages?access_token=${encodeURIComponent(config.pageAccessToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipient: { id: threadId }, message: { text: body } }),
    });
    const data = (await res.json()) as { message_id?: string; error?: { message?: string } };
    if (!data.message_id) throw new Error(data.error?.message ?? "send failed");
    return { externalId: data.message_id };
  },
};

const zalo: ChannelDriver = {
  kind: "zalo",
  fields: [
    { key: "oaId" },
    { key: "accessToken", secret: true },
    { key: "appSecret", secret: true },
  ],

  async check(config) {
    try {
      const res = await fetch(`${zaloApiBase(config)}/oa/getoa?access_token=${encodeURIComponent(config.accessToken)}`);
      const data = (await res.json()) as { data?: { id?: string; name?: string }; error?: number; message?: string };
      if (!data.data?.id) return { ok: false, error: data.message ?? "Zalo OA rejected the access token" };
      return { ok: true, externalId: String(data.data.id), name: data.data.name ?? "Zalo OA" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
  },

  parse(payload) {
    return parseZaloWebhook(payload);
  },

  verify(config, _request, _secret, rawBody = "") {
    return verifyZaloSignature(config.appSecret, rawBody, _request.headers.get("x-zalo-signature"));
  },

  async send(config, threadId, body) {
    const res = await fetch(`${zaloApiBase(config)}/oa/message?access_token=${encodeURIComponent(config.accessToken)}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipient: { user_id: threadId },
        message: { text: body },
      }),
    });
    const data = (await res.json()) as { data?: { message_id?: string }; error?: number; message?: string };
    if (!data.data?.message_id) throw new Error(data.message ?? "send failed");
    return { externalId: data.data.message_id };
  },
};

export const DRIVERS: Record<string, ChannelDriver> = { telegram, messenger, instagram, zalo };

/** Kept for UI that still distinguishes planned vs live channels. */
export const PLANNED_KINDS = [] as const;

export function driverFor(kind: string): ChannelDriver | undefined {
  return DRIVERS[kind];
}
