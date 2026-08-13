import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { displayMoney } from "@/lib/currency";
import TicketThread from "@/components/tickets/ticket-thread";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Ticket" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const { t, locale, currency } = ctx;

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, email: true, balance: true, publicId: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { username: true } } } },
    },
  });
  if (!ticket) notFound();

  const fmtDate = new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : locale, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/admin/tickets" className="btn btn-ghost btn-sm">
        <Icon name="chevronLeft" size={15} />
        {t("dash.tickets")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">{ticket.subject}</h2>
          <p className="muted mt-1 text-xs">
            #{ticket.publicId} · {t(`support.category.${ticket.category}`)}
          </p>
        </div>
        <StatusBadge status={ticket.status} label={t(`support.status.${ticket.status}`)} />
      </div>

      <div className="card card-pad flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <span>
          <span className="muted">{t("auth.username")}: </span>
          <strong>{ticket.user.username}</strong>
        </span>
        <span className="muted">{ticket.user.email}</span>
        <span>
          <span className="muted">{t("common.balance")}: </span>
          <strong>{displayMoney(ticket.user.balance, currency, locale)}</strong>
        </span>
      </div>

      <TicketThread
        ticketId={ticket.id}
        status={ticket.status}
        isStaff
        messages={ticket.messages.map((m) => ({
          id: m.id,
          body: m.body,
          fromStaff: m.fromStaff,
          author: m.author?.username ?? "—",
          createdAt: fmtDate.format(m.createdAt),
        }))}
        labels={{
          staff: t("support.staff"),
          reply: t("support.reply"),
          send: t("support.send"),
          close: t("support.close"),
          reopen: t("support.reopen"),
          closedNote: t("support.closedNote"),
        }}
      />
    </div>
  );
}
