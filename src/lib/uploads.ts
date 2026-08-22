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

/**
 * Reads the intrinsic size straight from the file header, so no image library
 * ever decodes a file somebody uploaded. Zeroes for a header we cannot read:
 * a size we failed to parse is not a reason to refuse the image.
 */
export function imageDimensions(mime: string, bytes: Uint8Array): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  try {
    if (mime === "image/png" && bytes.length > 24) {
      return { width: view.getUint32(16), height: view.getUint32(20) };
    }
    if (mime === "image/gif" && bytes.length > 10) {
      return { width: view.getUint16(6, true), height: view.getUint16(8, true) };
    }
    if (mime === "image/jpeg") {
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] !== 0xff) {
          i += 1;
          continue;
        }
        const marker = bytes[i + 1];
        // SOF0..SOF15, skipping the non-frame markers in that range.
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { height: view.getUint16(i + 5), width: view.getUint16(i + 7) };
        }
        i += 2 + view.getUint16(i + 2);
      }
    }
  } catch {
    // A header we cannot parse is not a reason to reject the upload.
  }
  return { width: 0, height: 0 };
}
