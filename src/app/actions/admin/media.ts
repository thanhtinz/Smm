"use server";

import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { readerMessages } from "@/lib/context";
import { requirePanel } from "@/lib/tenancy";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";
import { UPLOAD_ROOT, UPLOAD_TYPES, imageDimensions } from "@/lib/uploads";

const ALLOWED = new Set(Object.keys(UPLOAD_TYPES));
const MAX_BYTES = 512 * 1024;

export type UploadResult = { url?: string; id?: string; error?: string };

export async function uploadImageAction(formData: FormData): Promise<UploadResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: t("adm.chooseFile") };
  if (!ALLOWED.has(file.type)) return { error: t("adm.imageType") };
  if (file.size > MAX_BYTES) return { error: t("adm.imageTooBig", { kb: Math.round(MAX_BYTES / 1024) }) };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { width, height } = imageDimensions(file.type, bytes);

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
