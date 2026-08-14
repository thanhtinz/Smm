"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { nextPublicId } from "@/lib/ids";
import { notification } from "@/lib/notify";
import { readerMessages } from "@/lib/context";

export type TicketState = {
  error?: string;
  fieldErrors?: Record<string, string>;
};

const OPEN_STATUSES = ["open", "answered", "pending"];

export async function createTicketAction(_prev: TicketState, form: FormData): Promise<TicketState> {
  const t = await readerMessages();
  const user = await getCurrentUser();
  if (!user) return { error: t("err.session") };

  if (!(await getSetting("support.enabled"))) {
    return { error: t("err.supportClosed") };
  }

  const subject = String(form.get("subject") ?? "").trim();
  const category = String(form.get("category") ?? "general").trim();
  const body = String(form.get("body") ?? "").trim();

  const fieldErrors: Record<string, string> = {};
  if (subject.length < 4) fieldErrors.subject = "Give the ticket a subject";
  if (body.length < 10) fieldErrors.body = "Describe the problem in a little more detail";
  if (Object.keys(fieldErrors).length) return { fieldErrors };

  const maxOpen = Number(await getSetting("support.maxOpenTickets")) || 0;
  if (maxOpen > 0) {
    const open = await db.ticket.count({ where: { userId: user.id, status: { in: OPEN_STATUSES } } });
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
      // A staff reply is "answered"; a customer reply puts it back in the queue.
      data: { status: isStaff ? "answered" : "open", updatedAt: new Date() },
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
