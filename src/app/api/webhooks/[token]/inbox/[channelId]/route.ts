import { getSetting } from "@/lib/settings";
import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel } from "@/lib/tenancy";
import { driverFor } from "@/lib/inbox/drivers";
import { receive } from "@/lib/inbox/store";

async function loadChannel(token: string, channelId: string) {
  const panel = await basePrisma.panel.findFirst({ where: { webhookToken: token } });
  if (!panel) return null;

  const channel = await basePrisma.channel.findFirst({ where: { id: channelId, panelId: panel.id } });
  if (!channel || !channel.enabled) return null;

  const driver = driverFor(channel.kind);
  if (!driver) return null;

  return { panel, channel, driver, config: JSON.parse(channel.config || "{}") as Record<string, string> };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; channelId: string }> },
) {
  const { token, channelId } = await params;
  const loaded = await loadChannel(token, channelId);
  if (!loaded) return NextResponse.json({ ok: false }, { status: 404 });

  const challenge = loaded.driver.challenge?.(request, loaded.config);
  if (challenge) return new Response(challenge, { status: 200 });

  return NextResponse.json({ ok: false }, { status: 404 });
}

/**
 * Where messages arrive.
 *
 * The channel is named in the path rather than read out of the payload,
 * because half these platforms do not say which account an update belongs to
 * and the other half say it in a different place each. One address per
 * connected channel costs nothing and removes the guessing.
 *
 * The reply is always 200. Every one of these platforms retries on anything
 * else, and a payload we cannot use will not become usable on the fourth
 * delivery — so a shape we do not handle is acknowledged and dropped.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string; channelId: string }> },
) {
  const { token, channelId } = await params;
  const loaded = await loadChannel(token, channelId);
  if (!loaded) return NextResponse.json({ ok: false }, { status: 404 });

  const { panel, channel, driver, config } = loaded;

  const raw = await request.text();

  if (driver.verify) {
    if (driver.kind === "telegram") {
      if (config.secret && !driver.verify(config, request, config.secret, raw)) {
        return NextResponse.json({ ok: false }, { status: 401 });
      }
    } else if (!driver.verify(config, request, config.secret ?? "", raw)) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  } else {
    const requireSignature = await runAsPanel(panel.id, async () => getSetting("inbox.requireSignature"));
    if (requireSignature) {
      return NextResponse.json({ ok: false, message: "Channel has no signing secret" }, { status: 401 });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = driver.parse(payload);
  if (!messages.length) return NextResponse.json({ ok: true });

  await runAsPanel(panel.id, async () => {
    for (const message of messages) {
      await receive(channel.id, { ...message, accountId: message.accountId || channel.externalId });
    }
  });

  return NextResponse.json({ ok: true });
}
