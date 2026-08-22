import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join, resolve, sep } from "path";
import { getCurrentPanel } from "@/lib/tenancy";
import { UPLOAD_ROOT, LEGACY_UPLOAD_ROOT, uploadMime } from "@/lib/uploads";

/**
 * Serves an uploaded image off disk.
 *
 * Files used to be written under `public/`, which meant the web server handed
 * them out and this route did not need to exist. It also meant a production
 * server only ever served the files that were on disk when it booted: `next
 * start` reads `public/` once, so an image uploaded through the admin area
 * answered 404 until somebody restarted the process. An operator changing a
 * logo has no reason to expect that, and no way to guess it.
 *
 * So uploads now land outside `public/` and are read per request. The address
 * is unchanged — `/uploads/<panel>/<name>.png` — because those strings are
 * already stored in settings, in page bodies and in blog posts, and rewriting
 * them would be a migration in exchange for nothing.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;

  // Uploads are panel-scoped, the same way /api/media is: a host we do not
  // serve has no panel to serve files for.
  if (!(await getCurrentPanel())) return new NextResponse("Not found", { status: 404 });

  const mime = uploadMime(path.at(-1) ?? "");
  if (!mime) return new NextResponse("Not found", { status: 404 });

  const bytes = await readUnder(UPLOAD_ROOT, path);
  // Files written before uploads moved are still where they were left. They
  // are normally served straight from `public/`, ahead of this route; reading
  // them here as well means moving the directory does not lose them.
  const found = bytes ?? (await readUnder(LEGACY_UPLOAD_ROOT, path));
  if (!found) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(found), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(found.byteLength),
      // The name is random per upload, so the bytes behind one never change.
      "Cache-Control": "public, max-age=31536000, immutable",
      // User-supplied bytes served from our own origin.
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}

/**
 * Reads `segments` under `root`, or null. The resolved path is checked to be
 * inside the root rather than the segments checked for `..`: the check that
 * matters is where the path actually landed, and a decoded segment can carry
 * more than it looks like it does.
 */
async function readUnder(root: string, segments: string[]): Promise<Buffer | null> {
  const target = resolve(join(root, ...segments));
  if (target !== root && !target.startsWith(root + sep)) return null;
  try {
    return await readFile(target);
  } catch {
    return null;
  }
}
