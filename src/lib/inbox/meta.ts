import { createHmac, timingSafeEqual } from "node:crypto";

export function metaGraphBase(config: Record<string, string>): string {
  const base = (config.apiBase || "https://graph.facebook.com/v21.0").replace(/\/+$/, "");
  return base;
}

export function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = header.slice(7);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

type MetaMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  message?: { mid?: string; text?: string };
};

type MetaEntry = {
  id?: string;
  messaging?: MetaMessaging[];
};

export function parseMetaMessaging(payload: unknown, accountField: "id" | "recipientId" = "id"): Array<{
  accountId: string;
  threadId: string;
  externalId: string;
  body: string;
  contactName: string;
  contactHandle: string;
}> {
  const root = payload as { entry?: MetaEntry[] };
  const out: Array<{
    accountId: string;
    threadId: string;
    externalId: string;
    body: string;
    contactName: string;
    contactHandle: string;
  }> = [];

  for (const entry of root.entry ?? []) {
    const accountId = String(entry.id ?? "");
    for (const event of entry.messaging ?? []) {
      const text = event.message?.text;
      const sender = event.sender?.id;
      const mid = event.message?.mid;
      if (!text || !sender || !mid) continue;
      out.push({
        accountId: accountField === "id" ? accountId : String(event.recipient?.id ?? accountId),
        threadId: sender,
        externalId: mid,
        body: text,
        contactName: sender,
        contactHandle: "",
      });
    }
  }

  return out;
}

export function metaChallenge(request: Request, verifyToken: string): string | null {
  const url = new URL(request.url);
  if (url.searchParams.get("hub.mode") !== "subscribe") return null;
  if (url.searchParams.get("hub.verify_token") !== verifyToken) return null;
  return url.searchParams.get("hub.challenge");
}
