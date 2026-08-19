import { createHmac, timingSafeEqual } from "node:crypto";

export function zaloApiBase(config: Record<string, string>): string {
  return (config.apiBase || "https://openapi.zalo.me/v3.0").replace(/\/+$/, "");
}

export function verifyZaloSignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

type ZaloWebhook = {
  event_name?: string;
  sender?: { id?: string; name?: string };
  message?: { msg_id?: string; text?: string };
  oa_id?: string;
};

export function parseZaloWebhook(payload: unknown) {
  const event = payload as ZaloWebhook;
  const text = event.message?.text;
  const senderId = event.sender?.id;
  const msgId = event.message?.msg_id;
  if (event.event_name !== "user_send_text" || !text || !senderId || !msgId) return [];

  return [
    {
      accountId: String(event.oa_id ?? ""),
      threadId: senderId,
      externalId: msgId,
      body: text,
      contactName: event.sender?.name ?? senderId,
      contactHandle: "",
    },
  ];
}
