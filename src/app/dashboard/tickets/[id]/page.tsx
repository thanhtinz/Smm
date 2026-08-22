import { pageTitle } from "@/lib/page-title";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAppContext } from "@/lib/context";
import { dateFormats } from "@/lib/dates";
import TicketThread from "@/components/tickets/ticket-thread";
import StatusBadge from "@/components/ui/status-badge";
import { Icon } from "@/components/icons";
import { attachmentRules } from "@/lib/ticket-attachments";

export const generateMetadata = pageTitle("ticket.heading");

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getAppContext();
  const user = ctx.user!;
  const { t, locale, timezone } = ctx;
  const dates = dateFormats(locale, timezone);

  const ticket = await db.ticket.findFirst({
    where: { id, userId: user.id },
    include: {
      mergedInto: { select: { id: true, publicId: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { username: true } },
          attachments: { select: { id: true, filename: true, width: true, height: true } },
        },
      },
    },
  });
  if (!ticket) notFound();

  const attachments = await attachmentRules();

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

      {/* The customer opened this one and will look for the answer here, so
          the pointer comes before the thread rather than after it. */}
      {ticket.mergedInto && (
        <div className="alert alert-info" role="status">
          <Icon name="layers" size={16} />
          <span>
            {t("support.merge.merged", { id: ticket.mergedInto.publicId })}{" "}
            <Link href={`/dashboard/tickets/${ticket.mergedInto.id}`} className="font-medium underline">
              {t("support.merge.openTarget", { id: ticket.mergedInto.publicId })}
            </Link>
          </span>
        </div>
      )}

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
          attachments: m.attachments,
        }))}
        labels={{
          staff: t("support.staff"),
          reply: t("support.reply"),
          send: t("support.send"),
          close: t("support.close"),
          reopen: t("support.reopen"),
          closedNote: t("support.closedNote"),
          attach: t("support.attach"),
          attachHint: attachments ? t("support.attachHint", { count: attachments.maxFiles, kb: attachments.maxKb }) : "",
          attachAgain: t("support.attachAgain"),
        }}
        attachments={attachments}
      />
    </div>
  );
}
