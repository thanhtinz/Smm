import { db } from "@/lib/db";
import { driverFor, type IncomingMessage } from "./drivers";

/**
 * Where an incoming message lands.
 *
 * One function because every driver ends here, and because the two things
 * that must not go wrong — not storing the same webhook twice, and not
 * letting a thread from one channel answer on another — are easier to keep
 * right in one place than in four.
 */
export async function receive(channelId: string, message: IncomingMessage): Promise<{ stored: boolean }> {
  const channel = await db.channel.findFirst({ where: { id: channelId } });
  if (!channel) return { stored: false };

  const conversation = await db.conversation.upsert({
    where: {
      panelId_channelId_externalId: {
        panelId: channel.panelId,
        channelId: channel.id,
        externalId: message.threadId,
      },
    },
    create: {
      panelId: channel.panelId,
      channelId: channel.id,
      externalId: message.threadId,
      contactName: message.contactName,
      contactHandle: message.contactHandle,
      unread: 1,
      lastAt: new Date(),
    },
    update: {
      // People change their display name; the thread is the same thread.
      contactName: message.contactName || undefined,
      contactHandle: message.contactHandle || undefined,
      unread: { increment: 1 },
      lastAt: new Date(),
      // A closed thread the customer writes into again is open again.
      status: "open",
    },
  });

  try {
    await db.inboxMessage.create({
      data: {
        panelId: channel.panelId,
        conversationId: conversation.id,
        direction: "in",
        body: message.body,
        externalId: message.externalId,
      },
    });
  } catch {
    // The unique index on (panel, conversation, externalId) is the whole
    // idempotency story: platforms redeliver webhooks they think were missed,
    // and the second delivery must be a no-op rather than a second message.
    //
    // The counter was already raised, so it is put back.
    await db.conversation.update({
      where: { id: conversation.id },
      data: { unread: { decrement: 1 } },
    });
    return { stored: false };
  }

  return { stored: true };
}

/** Sends a reply and records it, in that order — an unsent message is not history. */
export async function reply(conversationId: string, body: string, authorId: string) {
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId },
    include: { channel: true },
  });
  if (!conversation) throw new Error("conversation gone");

  const driver = driverFor(conversation.channel.kind);
  if (!driver) throw new Error(`no driver for ${conversation.channel.kind}`);

  const config = JSON.parse(conversation.channel.config || "{}") as Record<string, string>;
  const sent = await driver.send(config, conversation.externalId, body);

  await db.$transaction([
    db.inboxMessage.create({
      data: {
        panelId: conversation.panelId,
        conversationId: conversation.id,
        direction: "out",
        body,
        externalId: sent.externalId ?? null,
        authorId,
      },
    }),
    db.conversation.update({
      where: { id: conversation.id },
      // Replying reads the thread, so it clears the unread count as well.
      data: { lastAt: new Date(), unread: 0 },
    }),
  ]);
}
