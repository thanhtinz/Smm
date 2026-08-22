import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve, sep } from "path";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/two-factor";
import { ATTACHMENT_ROOT } from "@/lib/ticket-attachments";

/**
 * Serves an image posted with a ticket message, to the two people entitled to
 * see it: the customer whose ticket it is, and the desk.
 *
 * Unlike an operator's uploads, these are not public files with unguessable
 * names — a screenshot of somebody's account, or of a payment, is the sort of
 * thing a support desk receives all day. So the check is on who is asking,
 * not on whether they knew the address.
 *
 * Everything that fails answers 404 rather than 403. A 403 would confirm the
 * attachment exists to whoever asked, which is most of what an id is worth.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getCurrentUser();
  if (!user) return notFound();

  // db is panel-scoped, so an id belonging to another panel is already gone
  // before any of this decides anything.
  const attachment = await db.ticketAttachment.findUnique({
    where: { id },
    select: {
      path: true,
      mime: true,
      filename: true,
      message: { select: { ticket: { select: { userId: true } } } },
    },
  });
  if (!attachment) return notFound();

  const staff = STAFF_ROLES.has(user.role);
  if (!staff && attachment.message.ticket.userId !== user.id) return notFound();

  const target = resolve(join(ATTACHMENT_ROOT, "..", attachment.path));
  // The path is ours — written by storeAttachments, never by a request — but
  // it is read off a row, and a row is a place a mistake can be stored.
  if (!target.startsWith(ATTACHMENT_ROOT + sep)) return notFound();

  let bytes: Buffer;
  try {
    bytes = await readFile(target);
  } catch {
    return notFound();
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": attachment.mime,
      "Content-Length": String(bytes.byteLength),
      // Private: this response depends on who asked, so no shared cache may
      // keep it and hand it to the next person.
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="${attachment.filename.replace(/["\\]/g, "")}"`,
      // User-supplied bytes served from our own origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

function notFound() {
  return new NextResponse("Not found", { status: 404 });
}
