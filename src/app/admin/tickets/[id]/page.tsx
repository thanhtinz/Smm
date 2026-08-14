import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import { displayMoney } from "@/lib/currency";
import TicketThread from "@/components/tickets/ticket-thread";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";
import PriorityPicker from "@/components/tickets/priority-picker";
import { TICKET_PRIORITIES, priorityKey, priorityTone } from "@/lib/tickets";

export const metadata: Metadata = { title: "Ticket" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const { t, locale, currency, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, email: true, balance: true, publicId: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { username: true } } } },
    },
  });
  if (!ticket) notFound();

  const fmtDate = { format: dates.stamp };
  const tone = priorityTone(ticket.priority);

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
        <div className="flex items-center gap-2">
          {tone && (
            <span className={`badge badge-${tone}`}>{t(`support.priority.${priorityKey(ticket.priority)}`)}</span>
          )}
          <StatusBadge status={ticket.status} label={t(`support.status.${ticket.status}`)} />
        </div>
      </div>

      <div className="card card-pad">
        <PriorityPicker
          ticketId={ticket.id}
          value={priorityKey(ticket.priority)}
          labels={{ title: t("support.priority.title"), saved: t("admin.saved") }}
          options={[...TICKET_PRIORITIES].reverse().map((p) => ({ key: p.key, label: t(`support.priority.${p.key}`) }))}
        />
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
