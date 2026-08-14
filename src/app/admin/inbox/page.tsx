import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Inbox" };

export default async function AdminInboxPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const { t, locale, timezone } = await getAppContext();
  const dates = dateFormats(locale, timezone);

  const status = params.status === "closed" ? "closed" : "open";

  const [threads, counts, channels] = await Promise.all([
    db.conversation.findMany({
      where: { status },
      orderBy: { lastAt: "desc" },
      take: 100,
      include: {
        channel: { select: { name: true, kind: true } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, direction: true } },
      },
    }),
    db.conversation.groupBy({ by: ["status"], _count: true }),
    db.channel.count(),
  ]);

  const countFor = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">{t("inbox.title")}</h2>
        <Link href="/admin/channels" className="btn btn-ghost btn-sm">
          <Icon name="settings" size={15} />
          {t("inbox.channels")}
        </Link>
      </div>

      {channels === 0 ? (
        <div className="card px-5 py-14 text-center">
          <span className="muted inline-flex">
            <Icon name="mail" size={30} />
          </span>
          <p className="muted mt-3 text-sm">{t("inbox.noChannels")}</p>
          <Link href="/admin/channels" className="btn btn-primary btn-sm mt-4">
            <Icon name="plus" size={15} />
            {t("inbox.connect")}
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <Tab href="/admin/inbox" active={status === "open"} label={t("inbox.open")} count={countFor("open")} />
            <Tab href="/admin/inbox?status=closed" active={status === "closed"} label={t("inbox.closed")} count={countFor("closed")} />
          </div>

          <div className="card overflow-hidden">
            {threads.length === 0 ? (
              <p className="muted px-5 py-14 text-center text-sm">{t("common.none")}</p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {threads.map((thread) => (
                  <li key={thread.id}>
                    <Link
                      href={`/admin/inbox/${thread.id}`}
                      className="flex items-center gap-3 px-5 py-4 hover:bg-[var(--surface2)]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-sm font-medium">
                          {thread.unread > 0 && (
                            <span className="badge badge-info tabular-nums">{thread.unread}</span>
                          )}
                          <span className="truncate">{thread.contactName || thread.externalId}</span>
                        </p>
                        <p className="muted mt-0.5 truncate text-xs">
                          {thread.channel.name} · {thread.messages[0]?.body ?? ""}
                        </p>
                      </div>
                      <span className="muted shrink-0 text-xs">{dates.stamp(thread.lastAt)}</span>
                      <Icon name="chevronRight" size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function Tab({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_15%,transparent)] text-[var(--primary)]"
          : "muted border-[var(--border)] hover:bg-[var(--surface2)] hover:text-[var(--text)]"
      }`}
    >
      {label}
      <span className="tabular-nums opacity-70">{count}</span>
    </Link>
  );
}
