import type { Metadata } from "next";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { renderNotification } from "@/lib/notify";
import NotificationList, { type NotificationRow } from "@/components/notification-list";

export const metadata: Metadata = { title: "Notifications" };

const PAGE_SIZE = 30;

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t } = ctx;
  const dates = dateFormats(ctx.locale, ctx.timezone);
  const page = Math.max(1, Number(params.page) || 1);

  const where = { userId: user.id };
  const [rows, total, unread] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.notification.count({ where }),
    db.notification.count({ where: { ...where, read: false } }),
  ]);

  const items: NotificationRow[] = rows.map((n) => ({
    id: n.id,
    ...renderNotification(n, t),
    level: n.level,
    read: n.read,
    href: n.href,
    when: dates.full(n.createdAt),
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <NotificationList
        items={items}
        unread={unread}
        read={total - unread}
        page={page}
        totalPages={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        labels={{
          title: t("dash.notifications"),
          empty: t("notify.empty"),
          markAll: t("notify.markAll"),
          clearRead: t("notify.clearRead"),
          confirmClear: t("notify.confirmClear"),
          unread: t("notify.unread"),
          prev: t("common.prev"),
          next: t("common.next"),
        }}
      />
    </div>
  );
}
