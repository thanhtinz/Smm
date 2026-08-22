import { join, resolve } from "path";

/**
 * Where uploaded files live. Deliberately outside `public/`: a production
 * server snapshots `public/` at boot, so anything written there afterwards is
 * a 404 until the process restarts. Files here are read per request instead,
 * by the route at /uploads/[...path].
 */
export const UPLOAD_ROOT = resolve(join(process.cwd(), "var", "uploads"));

/** Where they lived before that. Still read, never written. */
export const LEGACY_UPLOAD_ROOT = resolve(join(process.cwd(), "public", "uploads"));

/**
 * The image types an operator may upload, and the extension each is stored
 * under. SVG is absent on purpose: it can carry script, and these files come
 * back from our own origin.
 */
export const UPLOAD_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

const BY_EXTENSION = new Map(Object.entries(UPLOAD_TYPES).map(([mime, ext]) => [ext, mime]));

/**
 * The type to serve a stored file as, decided by the extension we chose when
 * writing it — never by anything the request said. An extension we do not
 * write is not a file we serve.
 */
export function uploadMime(filename: string): string | null {
  const dot = filename.lastIndexOf(".");
  if (dot < 1) return null;
  return BY_EXTENSION.get(filename.slice(dot + 1).toLowerCase()) ?? null;
}
