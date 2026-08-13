import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentPanel } from "@/lib/tenancy";

/**
 * Serves an uploaded image belonging to the panel being addressed. Content is
 * immutable once stored — the id is derived per upload — so it can be cached
 * indefinitely, and `private` keeps a shared cache from handing one panel's
 * bytes to a request for another.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Media is panel-scoped, so this only ever serves the panel whose host was
  // asked. A host we do not serve has no panel to scope by.
  if (!(await getCurrentPanel())) return new NextResponse("Not found", { status: 404 });

  const media = await db.media.findUnique({ where: { id } });
  if (!media) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mime,
      "Content-Length": String(media.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      // These are user-supplied bytes served from our origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
