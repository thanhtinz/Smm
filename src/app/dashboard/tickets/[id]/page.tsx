import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import TicketThread from "@/components/tickets/ticket-thread";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const ticket = await db.ticket.findFirst({
    where: { id, userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" }, include: { author: { select: { username: true } } } } },
  });
  if (!ticket) notFound();

  const fmtDate = { format: dates.stamp };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/dashboard/tickets" className="btn btn-ghost btn-sm">
        <Icon name="chevronLeft" size={15} />
        {t("dash.tickets")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight">{ticket.subject}</h2>
          <p className="muted mt-1 font-mono text-xs">#{ticket.publicId}</p>
        </div>
        <StatusBadge status={ticket.status} label={t(`support.status.${ticket.status}`)} />
      </div>

      <TicketThread
        ticketId={ticket.id}
        status={ticket.status}
        isStaff={false}
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
