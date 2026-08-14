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
import TicketTriage from "@/components/tickets/ticket-triage";
import MergeTicket from "@/components/tickets/merge-ticket";
import { TICKET_PRIORITIES, priorityKey, priorityTone } from "@/lib/tickets";
import { STAFF_ROLES } from "@/lib/two-factor";

export const metadata: Metadata = { title: "Ticket" };

export default async function AdminTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const { t, locale, currency, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const staff = await db.user.findMany({
    where: { role: { in: [...STAFF_ROLES] } },
    orderBy: { username: "asc" },
    select: { id: true, username: true },
  });

  const ticket = await db.ticket.findUnique({
    where: { id },
    include: {
      user: { select: { username: true, email: true, balance: true, publicId: true } },
      mergedInto: { select: { id: true, publicId: true } },
      mergedFrom: { select: { id: true, publicId: true } },
      messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { username: true } } } },
    },
  });
  if (!ticket) notFound();

  // Only this customer's other live tickets can be merged into, which is what
  // the server enforces too — the list just avoids offering the impossible.
  const mergeCandidates = ticket.mergedIntoId
    ? []
    : await db.ticket.findMany({
        where: { userId: ticket.userId, id: { not: ticket.id }, mergedIntoId: null },
        orderBy: { updatedAt: "desc" },
        select: { id: true, publicId: true, subject: true },
      });

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

      {/* Where the conversation went, said before anything else: everything
          below it is history the customer will not get answers on. */}
      {ticket.mergedInto && (
        <div className="alert alert-info" role="status">
          <Icon name="layers" size={16} />
          <span>
            {t("support.merge.merged", { id: ticket.mergedInto.publicId })}{" "}
            <Link href={`/admin/tickets/${ticket.mergedInto.id}`} className="font-medium underline">
              {t("support.merge.openTarget", { id: ticket.mergedInto.publicId })}
            </Link>
          </span>
        </div>
      )}

      <div className="card card-pad space-y-4">
        <TicketTriage
          ticketId={ticket.id}
          priority={priorityKey(ticket.priority)}
          assignee={ticket.assigneeId ?? ""}
          labels={{
            priority: t("support.priority.title"),
            assignee: t("support.assignee.title"),
            nobody: t("support.assignee.none"),
            saved: t("admin.saved"),
          }}
          priorities={[...TICKET_PRIORITIES].reverse().map((p) => ({ key: p.key, label: t(`support.priority.${p.key}`) }))}
          staff={staff.map((u) => ({ key: u.id, label: u.username }))}
        />

        {!ticket.mergedIntoId && (
          <div className="border-t border-[var(--border)] pt-4">
            <MergeTicket
              ticketId={ticket.id}
              candidates={mergeCandidates.map((c) => ({ id: c.id, label: `#${c.publicId} — ${c.subject}` }))}
              labels={{
                title: t("support.merge.title"),
                none: t("support.merge.none"),
                action: t("support.merge.action"),
                confirm: t("support.merge.confirm"),
                hint: t("support.merge.hint"),
              }}
            />
          </div>
        )}
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
