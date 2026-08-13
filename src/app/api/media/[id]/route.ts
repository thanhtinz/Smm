import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Serves an uploaded image. Content is immutable once stored — the id is
 * derived per upload — so it can be cached indefinitely.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const media = await db.media.findUnique({ where: { id } });
  if (!media) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(media.data), {
    headers: {
      "Content-Type": media.mime,
      "Content-Length": String(media.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      // These are user-supplied bytes served from our origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
