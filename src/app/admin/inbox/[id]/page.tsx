import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { Icon } from "@/components/icons";
import Thread from "@/components/inbox/thread";

export const metadata: Metadata = { title: "Conversation" };

export default async function InboxThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);

  const thread = await db.conversation.findFirst({
    where: { id },
    include: {
      channel: { select: { name: true, kind: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { username: true } } } },
    },
  });
  if (!thread) notFound();

  // Opening the thread is reading it. Doing this here rather than behind a
  // button means the count means "nobody has looked", which is the only thing
  // it is useful for.
  if (thread.unread > 0) await db.conversation.update({ where: { id }, data: { unread: 0 } });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/inbox" className="btn btn-ghost btn-sm">
        <Icon name="chevronLeft" size={15} />
        {t("inbox.title")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">{thread.contactName || thread.externalId}</h2>
          <p className="muted mt-1 text-xs">
            {thread.channel.name}
            {thread.contactHandle ? ` · ${thread.contactHandle}` : ""}
          </p>
        </div>
        <span className={`badge ${thread.status === "closed" ? "badge-muted" : "badge-success"}`}>
          {t(`inbox.${thread.status}`)}
        </span>
      </div>

      <Thread
        conversationId={thread.id}
        status={thread.status}
        messages={thread.messages.map((m) => ({
          id: m.id,
          direction: m.direction,
          body: m.body,
          author: m.author?.username ?? "",
          createdAt: dates.stamp(m.createdAt),
        }))}
        labels={{
          empty: t("common.none"),
          reply: t("support.reply"),
          send: t("support.send"),
          close: t("inbox.close"),
          reopen: t("inbox.reopen"),
        }}
      />
    </div>
  );
}
