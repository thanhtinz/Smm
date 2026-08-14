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
};

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

export const DRIVERS: Record<string, ChannelDriver> = { telegram };

/**
 * Platforms the inbox is built for but has no driver for yet.
 *
 * Messenger, Instagram and Zalo all need a reviewed app and a business
 * account before a single message moves, none of which can be obtained or
 * exercised from here. Listing them as connectable and shipping code nobody
 * has ever run would be worse than saying plainly that they are next.
 */
export const PLANNED_KINDS = ["messenger", "instagram", "zalo"] as const;

export function driverFor(kind: string): ChannelDriver | undefined {
  return DRIVERS[kind];
}
