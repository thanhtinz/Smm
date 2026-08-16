"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";
import { notification } from "@/lib/notify";
import { readerMessages } from "@/lib/context";
import { deny } from "@/lib/access";
import { OPEN_TICKET_STATUSES, TICKET_STATUSES, priorityKey, priorityValue } from "@/lib/tickets";
import { STAFF_ROLES } from "@/lib/two-factor";

export type TicketState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

export async function createTicketAction(_prev: TicketState, form: FormData): Promise<TicketState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.session") };

  const barred = deny(user, "ticket");
  if (barred) return { error: t(barred.key) };

  if (!(await getSetting("support.enabled"))) {
    return { error: t("err.supportClosed") };
  }

  const subject = String(form.get("subject") ?? "").trim();
  const category = String(form.get("category") ?? "general").trim();
  const body = String(form.get("body") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (subject.length < 4) fieldErrors.subject = t("err.subjectRequired");
  if (body.length < 10) fieldErrors.body = t("err.bodyShort");
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const maxOpen = Number(await getSetting("support.maxOpenTickets")) || 0;
  if (maxOpen > 0) {
    const open = await db.ticket.count({ where: { userId: user.id, status: { in: OPEN_TICKET_STATUSES } } });
    if (open >= maxOpen) {
      return { error: t("err.ticketsOpen", { count: open }) };
    }
  }

  const ticket = await db.ticket.create({
    data: {
      publicId: await nextPublicId("ticket"),
      userId: user.id,
      subject,
      category,
      status: "open",
      // Nested writes bypass the panel filter in src/lib/db.ts — it only sees
      // the outer ticket.create — so the first message carries its own panelId.
      messages: { create: { panelId: user.panelId, authorId: user.id, fromStaff: false, body } },
    },
  });

  await logActivity(user.id, "ticket.create", `#${ticket.publicId}`);
  revalidatePath("/dashboard/tickets");
  redirect(`/dashboard/tickets/${ticket.id}`);
}

export async function replyTicketAction(_prev: TicketState, form: FormData): Promise<TicketState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.session") };

  const ticketId = String(form.get("ticketId") ?? "");
  const body = String(form.get("body") ?? "").trim();
  if (body.length < 2) return { fieldErrors: { body: t("err.replyEmpty") } };

  const isStaff = user.role === "admin" || user.role === "support";
  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, ...(isStaff ? {} : { userId: user.id }) },
  });
  if (!ticket) return { error: t("err.ticketGone") };
  if (ticket.status === "closed") return { error: t("err.ticketClosed") };

  await db.$transaction([
    db.ticketMessage.create({
      data: { ticketId: ticket.id, authorId: user.id, fromStaff: isStaff, body },
    }),
    db.ticket.update({
      where: { id: ticket.id },
      data: {
        // A staff reply is "answered"; a customer reply puts it back in the queue.
        status: isStaff ? "answered" : "open",
        updatedAt: new Date(),
        // Answering an unclaimed ticket claims it. Whoever replied is working
        // it whether or not they thought to say so, and the alternative is a
        // queue where "unassigned" stops meaning "nobody has looked".
        ...(isStaff && !ticket.assigneeId ? { assigneeId: user.id } : {}),
      },
    }),
  ]);

  if (isStaff && ticket.userId !== user.id) {
    await db.notification.create({
      data: notification({
        userId: ticket.userId,
        key: "ticket.reply",
        params: { id: ticket.publicId, subject: ticket.subject },
        href: `/dashboard/tickets/${ticket.id}`,
      }),
    });
  }

  revalidatePath(`/dashboard/tickets/${ticket.id}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticket.id}`);
  return {};
}

export async function setTicketStatusAction(ticketId: string, status: string): Promise<TicketState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };

  // Checked against the list rather than trusted from the client: a status
  // outside it matches no queue filter and no badge, so the ticket would
  // simply vanish from every screen that looks for it.
  if (!TICKET_STATUSES.includes(status as never)) return { error: t("adm.unknownStatus") };

  const isStaff = user.role === "admin" || user.role === "support";
  // A customer may close their own ticket, but not reopen or re-queue it.
  if (!isStaff && status !== "closed") return { error: t("err.supportOnly") };

  const ticket = await db.ticket.findFirst({
    where: { id: ticketId, ...(isStaff ? {} : { userId: user.id }) },
  });
  if (!ticket) return { error: t("err.ticketGone") };

  await db.ticket.update({ where: { id: ticket.id }, data: { status } });
  await logActivity(user.id, "ticket.status", `#${ticket.publicId} -> ${status}`);

  revalidatePath(`/dashboard/tickets/${ticket.id}`);
  revalidatePath("/dashboard/tickets");
  revalidatePath("/admin/tickets");
  return {};
}

export async function setTicketPriorityAction(ticketId: string, priority: string): Promise<TicketState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };

  // Triage is support's job. A customer rating their own urgency would make
  // the column say "urgent" on every row and stop being a queue order.
  if (user.role !== "admin" && user.role !== "support") return { error: t("err.supportOnly") };

  const value = priorityValue(priority);
  if (value === null) return { error: t("err.priorityUnknown") };

  const ticket = await db.ticket.findFirst({ where: { id: ticketId } });
  if (!ticket) return { error: t("err.ticketGone") };

  // updatedAt is the queue's tiebreaker, so setting a priority must not push
  // the ticket to the top of it — hence the explicit write of the old value.
  await db.ticket.update({
    where: { id: ticket.id },
    data: { priority: value, updatedAt: ticket.updatedAt },
  });
  await logActivity(user.id, "ticket.priority", `#${ticket.publicId} -> ${priorityKey(value)}`);

  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticket.id}`);
  return {};
}

export async function setTicketAssigneeAction(ticketId: string, assigneeId: string): Promise<TicketState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };
  if (!STAFF_ROLES.has(user.role)) return { error: t("err.supportOnly") };

  const ticket = await db.ticket.findFirst({ where: { id: ticketId } });
  if (!ticket) return { error: t("err.ticketGone") };

  // The empty string is "nobody", which is a legitimate thing to set — a
  // ticket handed back to the queue is not the same as one nobody touched.
  let assignee: { id: string; username: string } | null = null;
  if (assigneeId) {
    // findFirst, so the panel filter applies: one panel's staff can never be
    // put on another panel's ticket.
    const found = await db.user.findFirst({
      where: { id: assigneeId, role: { in: [...STAFF_ROLES] } },
      select: { id: true, username: true },
    });
    if (!found) return { error: t("err.assigneeUnknown") };
    assignee = found;
  }

  // updatedAt carries the queue order, so claiming a ticket must not move it.
  await db.ticket.update({
    where: { id: ticket.id },
    data: { assigneeId: assignee?.id ?? null, updatedAt: ticket.updatedAt },
  });

  // Handing someone else a ticket is news to them; claiming one yourself is
  // not, so no notification goes out for that.
  if (assignee && assignee.id !== user.id) {
    await db.notification.create({
      data: notification({
        userId: assignee.id,
        key: "ticket.assigned",
        params: { id: ticket.publicId, subject: ticket.subject },
        href: `/admin/tickets/${ticket.id}`,
      }),
    });
  }

  await logActivity(user.id, "ticket.assign", `#${ticket.publicId} -> ${assignee?.username ?? "—"}`);
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${ticket.id}`);
  return {};
}

export async function mergeTicketAction(sourceId: string, targetId: string): Promise<TicketState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.sessionShort") };
  if (!STAFF_ROLES.has(user.role)) return { error: t("err.supportOnly") };
  if (sourceId === targetId) return { error: t("err.mergeSelf") };

  const [source, target] = await Promise.all([
    db.ticket.findFirst({ where: { id: sourceId }, include: { _count: { select: { messages: true } } } }),
    db.ticket.findFirst({ where: { id: targetId } }),
  ]);
  if (!source || !target) return { error: t("err.ticketGone") };

  // The one rule that matters. Two customers' threads in one ticket would
  // show each of them the other's messages, and a support desk is exactly
  // where people paste order links and transaction references.
  if (source.userId !== target.userId) return { error: t("err.mergeOtherUser") };

  // Merging into something already merged would leave the thread one hop
  // further away than the pointer says.
  if (target.mergedIntoId) return { error: t("err.mergeIntoMerged") };
  if (source.mergedIntoId) return { error: t("err.mergeAlready") };

  await db.$transaction([
    // The messages move, so the conversation reads in one place.
    db.ticketMessage.updateMany({ where: { ticketId: source.id }, data: { ticketId: target.id } }),
    db.ticket.update({
      where: { id: source.id },
      data: { mergedIntoId: target.id, status: "closed" },
    }),
    db.ticket.update({
      where: { id: target.id },
      data: {
        // Folding a live question into a closed ticket has to reopen it,
        // otherwise the merge quietly buries the thing the customer asked.
        ...(target.status === "closed" ? { status: "open" } : {}),
        // Whichever was more urgent decides, because the merged ticket now
        // carries both questions.
        priority: Math.max(source.priority, target.priority),
        updatedAt: new Date(),
      },
    }),
  ]);

  await db.notification.create({
    data: notification({
      userId: source.userId,
      key: "ticket.merged",
      params: { id: source.publicId, into: target.publicId },
      href: `/dashboard/tickets/${target.id}`,
    }),
  });

  await logActivity(user.id, "ticket.merge", `#${source.publicId} -> #${target.publicId}`);
  revalidatePath("/admin/tickets");
  revalidatePath(`/admin/tickets/${source.id}`);
  revalidatePath(`/admin/tickets/${target.id}`);
  revalidatePath("/dashboard/tickets");
  return {};
}
