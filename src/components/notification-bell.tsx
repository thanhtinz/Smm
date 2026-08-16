"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Icon } from "@/components/icons";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";

export type BellItem = {
  id: string;
  title: string;
  body: string;
  level: string;
  read: boolean;
  href: string;
  when: string;
};

const DOT: Record<string, string> = {
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

/**
 * Notifications were being written by a dozen places — refunds, refill
 * decisions, top-ups, ticket replies — and read by nothing but a four-row card
 * on the dashboard, where anything older than the last four scrolled off
 * unseen. This is where they are actually read.
 */
export default function NotificationBell({
  items,
  unread,
  labels,
}: {
  items: BellItem[];
  unread: number;
  labels: Record<"title" | "empty" | "markAll" | "seeAll" | "unread", string>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={unread ? `${labels.title} — ${unread} ${labels.unread}` : labels.title}
        className="ring-focus relative flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border)] transition-colors hover:bg-[var(--surface2)]"
      >
        <Icon name="bell" size={16} />
        {unread > 0 && (
          <span className="absolute -top-1 -end-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[var(--primary)] px-1 text-[0.62rem] font-bold text-white tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="popover absolute end-0 z-50 mt-2 w-80 overflow-hidden p-0 shadow-2xl">
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-3.5 py-3">
            <p className="text-sm font-semibold">{labels.title}</p>
            {unread > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => start(() => void markAllNotificationsReadAction())}
                className="muted text-xs hover:text-[var(--text)] disabled:opacity-50"
              >
                {labels.markAll}
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="muted px-3.5 py-10 text-center text-sm">{labels.empty}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-[var(--border)] overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Row item={n} onOpen={() => setOpen(false)} />
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[var(--border)]">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="muted block px-3.5 py-3 text-center text-xs hover:text-[var(--text)]"
            >
              {labels.seeAll}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ item, onOpen }: { item: BellItem; onOpen: () => void }) {
  const router = useRouter();
  const [, start] = useTransition();

  // Opening one is what marks it read; a separate control for that would be a
  // second thing to press for no gain.
  //
  // The navigation is done by hand rather than left to the Link. Both the
  // server action and Link's own navigation are transitions, and starting them
  // in the same click makes them race: the action was cancelled and the reader
  // stayed put. Marking first and pushing after is the only order that does
  // both.
  const seen = (e: React.MouseEvent) => {
    onOpen();
    if (item.read) return;
    if (item.href) e.preventDefault();
    start(async () => {
      await markNotificationReadAction(item.id);
      if (item.href) router.push(item.href);
    });
  };

  const inner = (
    <>
      <span
        aria-hidden
        className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
        style={{ background: item.read ? "var(--border)" : (DOT[item.level] ?? "var(--primary)") }}
      />
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm ${item.read ? "" : "font-semibold"}`}>{item.title}</span>
        <span className="muted whitespace-pre-line mt-0.5 line-clamp-2 block text-xs">{item.body}</span>
        <span className="muted mt-1 block text-[0.68rem]">{item.when}</span>
      </span>
    </>
  );

  const className = "flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-[var(--surface2)]";

  return item.href ? (
    <Link href={item.href} onClick={seen} className={className}>
      {inner}
    </Link>
  ) : (
    <button type="button" onClick={seen} className={className}>
      {inner}
    </button>
  );
}
