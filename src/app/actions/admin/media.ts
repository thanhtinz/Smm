"use server";

import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { requirePanel } from "@/lib/tenancy";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { UPLOAD_ROOT, UPLOAD_TYPES } from "@/lib/uploads";

const ALLOWED = new Set(Object.keys(UPLOAD_TYPES));
const MAX_BYTES = 512 * 1024;

export type UploadResult = { url?: string; id?: string; error?: string };

/** Reads the intrinsic size straight from the file header. */
function readDimensions(mime: string, bytes: Uint8Array): { width: number; height: number } {
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

export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("adm.chooseFile") };
  if (!ALLOWED.has(file.type)) return { error: t("adm.imageType") };
  if (file.size > MAX_BYTES) return { error: t("adm.imageTooBig", { kb: Math.round(MAX_BYTES / 1024) }) };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { width, height } = readDimensions(file.type, bytes);

  // Written under the panel's own folder: it keeps one panel's uploads
  // separable on disk, which is what makes them possible to back up, move or
  // delete as a unit. The folder sits outside public/, so the file is served
  // by the /uploads route and is readable the moment it is written rather
  // than after the next restart.
  const panel = await requirePanel();
  const folder = join(UPLOAD_ROOT, panel.id);
  await mkdir(folder, { recursive: true });

  // The name is random rather than the one the file arrived with. An operator
  // uploading "logo.png" twice must not overwrite the first, and a name from
  // outside must not choose where it lands.
  const filename = `${randomBytes(12).toString("hex")}.${UPLOAD_TYPES[file.type]}`;
  await writeFile(join(folder, filename), bytes);

  const path = `uploads/${panel.id}/${filename}`;
  const media = await db.media.create({
    data: { mime: file.type, size: file.size, width, height, path },
  });

  await logActivity(admin.id, "admin.media.upload", `${path} ${file.size}B`);
  return { url: `/${path}`, id: media.id };
}
