"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/icons";
import {
  clearReadNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notifications";

export type NotificationRow = {
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

/** The whole history, rather than the eight the bell has room for. */
export default function NotificationList({
  items,
  unread,
  read,
  page,
  totalPages,
  labels,
}: {
  items: NotificationRow[];
  unread: number;
  read: number;
  page: number;
  totalPages: number;
  labels: Record<"title" | "empty" | "markAll" | "clearRead" | "confirmClear" | "unread" | "prev" | "next", string>;
}) {
  const [pending, start] = useTransition();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-bold tracking-tight">
          {labels.title}
          {unread > 0 && <span className="badge badge-info ml-2.5 align-middle">{unread}</span>}
        </h2>
        <div className="flex gap-2">
          {unread > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => start(() => void markAllNotificationsReadAction())}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="check" size={15} />
              {labels.markAll}
            </button>
          )}
          {read > 0 && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (confirm(labels.confirmClear)) start(() => void clearReadNotificationsAction());
              }}
              className="btn btn-ghost btn-sm"
            >
              <Icon name="trash" size={15} />
              {labels.clearRead}
            </button>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <p className="muted px-5 py-16 text-center text-sm">{labels.empty}</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {items.map((n) => (
              <li key={n.id}>
                <Row item={n} unreadLabel={labels.unread} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          <PageLink href={hrefFor(page - 1)} disabled={page <= 1} icon="chevronLeft" label={labels.prev} />
          <span className="muted text-sm tabular-nums">
            {page} / {totalPages}
          </span>
          <PageLink href={hrefFor(page + 1)} disabled={page >= totalPages} icon="chevronRight" label={labels.next} trailing />
        </nav>
      )}
    </>
  );
}

function hrefFor(page: number) {
  return page > 1 ? `/dashboard/notifications?page=${page}` : "/dashboard/notifications";
}

function Row({ item, unreadLabel }: { item: NotificationRow; unreadLabel: string }) {
  const router = useRouter();
  const [, start] = useTransition();

  // Marked first, navigated after: starting the action and letting the Link
  // navigate in the same click makes two transitions race, and the action is
  // the one that loses.
  const seen = (e: React.MouseEvent) => {
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
        className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: item.read ? "var(--border)" : (DOT[item.level] ?? "var(--primary)") }}
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-sm ${item.read ? "" : "font-semibold"}`}>
          {item.title}
          {!item.read && <span className="sr-only"> — {unreadLabel}</span>}
        </span>
        <span className="muted mt-0.5 block text-sm">{item.body}</span>
        <span className="muted mt-1.5 block text-xs">{item.when}</span>
      </span>
      {item.href && (
        <span className="muted mt-1 shrink-0">
          <Icon name="chevronRight" size={16} />
        </span>
      )}
    </>
  );

  const className = "flex w-full items-start gap-3 px-5 py-4 text-left hover:bg-[var(--surface2)]";

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

function PageLink({
  href,
  disabled,
  icon,
  label,
  trailing,
}: {
  href: string;
  disabled: boolean;
  icon: "chevronLeft" | "chevronRight";
  label: string;
  trailing?: boolean;
}) {
  if (disabled) {
    return (
      <span className="btn btn-ghost btn-sm opacity-40" aria-disabled>
        {!trailing && <Icon name={icon} size={15} />}
        {label}
        {trailing && <Icon name={icon} size={15} />}
      </span>
    );
  }
  return (
    <Link href={href} className="btn btn-ghost btn-sm">
      {!trailing && <Icon name={icon} size={15} />}
      {label}
      {trailing && <Icon name={icon} size={15} />}
    </Link>
  );
}
