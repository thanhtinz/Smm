import { NextResponse } from "next/server";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel } from "@/lib/tenancy";
import { driverFor } from "@/lib/inbox/drivers";
import { receive } from "@/lib/inbox/store";

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

  const panel = await basePrisma.panel.findFirst({ where: { webhookToken: token } });
  if (!panel) return NextResponse.json({ ok: false }, { status: 404 });

  // Read outside the panel scope to check it, then act inside it: a channel
  // id from another panel must not be reachable by knowing this panel's token.
  const channel = await basePrisma.channel.findFirst({ where: { id: channelId, panelId: panel.id } });
  if (!channel || !channel.enabled) return NextResponse.json({ ok: false }, { status: 404 });

  const driver = driverFor(channel.kind);
  if (!driver) return NextResponse.json({ ok: true });

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const messages = driver.parse(payload);
  if (!messages.length) return NextResponse.json({ ok: true });

  await runAsPanel(panel.id, async () => {
    for (const message of messages) await receive(channel.id, message);
  });

  return NextResponse.json({ ok: true });
}
