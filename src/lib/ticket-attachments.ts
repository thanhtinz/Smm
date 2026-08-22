import { mkdir, writeFile } from "fs/promises";
import { join, resolve } from "path";
import { randomBytes } from "crypto";
import { UPLOAD_TYPES, imageDimensions } from "./uploads";
import { getSetting } from "./settings";

/**
 * Images posted with a ticket message.
 *
 * They are kept out of `var/uploads` on purpose. What sits there is what an
 * operator uploaded for the panel to show — a logo, a hero image — and the
 * route serving it asks only that the host is a panel we run. A customer's
 * screenshot is the other kind of file: it belongs to one conversation, and
 * it is read back through a route that checks who is asking.
 */
export const ATTACHMENT_ROOT = resolve(join(process.cwd(), "var", "ticket-attachments"));

export type AttachmentLimits = {
  enabled: boolean;
  maxFiles: number;
  maxBytes: number;
};

/**
 * The rules as the operator has them set. Read once per post, so a limit
 * changed mid-conversation applies to the next message rather than to the one
 * already being written.
 */
export async function attachmentLimits(): Promise<AttachmentLimits> {
  const [enabled, maxFiles, maxKb] = await Promise.all([
    getSetting("support.attachments"),
    getSetting("support.attachmentMaxFiles"),
    getSetting("support.attachmentMaxKb"),
  ]);
  return {
    enabled: Boolean(enabled),
    maxFiles: Math.max(0, Number(maxFiles) || 0),
    maxBytes: Math.max(0, Number(maxKb) || 0) * 1024,
  };
}

/**
 * The same rules in the shape the thread needs to draw the picker: null when
 * there is no picker to draw. A limit of zero files is off as surely as the
 * switch is.
 */
export async function attachmentRules(): Promise<{ maxFiles: number; maxKb: number } | null> {
  const limits = await attachmentLimits();
  if (!limits.enabled || limits.maxFiles < 1 || limits.maxBytes < 1) return null;
  return { maxFiles: limits.maxFiles, maxKb: Math.round(limits.maxBytes / 1024) };
}

/** What a File gives us that the rules care about. */
export type IncomingFile = { name: string; type: string; size: number };

export type AttachmentPlan<T> = { ok: true; files: T[] } | { ok: false; error: AttachmentRefusal };

export type AttachmentRefusal = "disabled" | "tooMany" | "type" | "tooBig";

/**
 * Decides whether a set of picked files may be posted, before anything is
 * written or a message is created.
 *
 * An empty file input still posts a File — zero bytes, empty name — so those
 * are dropped rather than refused: a reply with nothing attached is the normal
 * case, and refusing it would make the box impossible to submit.
 */
export function planAttachments<T extends IncomingFile>(files: T[], limits: AttachmentLimits): AttachmentPlan<T> {
  const picked = files.filter((f) => f.size > 0);
  if (picked.length === 0) return { ok: true, files: [] };

  if (!limits.enabled) return { ok: false, error: "disabled" };
  if (picked.length > limits.maxFiles) return { ok: false, error: "tooMany" };
  // The type is checked against what we are prepared to serve back, not
  // against what the browser is prepared to send.
  if (picked.some((f) => !(f.type in UPLOAD_TYPES))) return { ok: false, error: "type" };
  if (picked.some((f) => f.size > limits.maxBytes)) return { ok: false, error: "tooBig" };

  return { ok: true, files: picked };
}

/** Control characters, which have no business in a name we render. */
const CONTROL = /[\u0000-\u001f\u007f]/g;

/**
 * The name shown beside the image in the thread. Display only — it never
 * decides where the file lands — but it is still a string somebody else typed,
 * so separators, control characters and a runaway length all come off it.
 */
export function displayName(name: string, mime: string): string {
  const cleaned = name
    .split(/[\\/]/)
    .pop()!
    .replace(CONTROL, "")
    .trim()
    .slice(0, 80);
  return cleaned || `image.${UPLOAD_TYPES[mime] ?? "png"}`;
}

export type StoredAttachment = {
  path: string;
  mime: string;
  size: number;
  width: number;
  height: number;
  filename: string;
};

/**
 * Writes the files and describes the rows to create for them. Called before
 * the message exists: an orphaned file costs disk, an attachment row pointing
 * at nothing costs a broken image in a conversation nobody can repair.
 */
export async function storeAttachments(panelId: string, files: File[]): Promise<StoredAttachment[]> {
  if (files.length === 0) return [];

  const folder = join(ATTACHMENT_ROOT, panelId);
  await mkdir(folder, { recursive: true });

  const stored: StoredAttachment[] = [];
  for (const file of files) {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { width, height } = imageDimensions(file.type, bytes);
    // Random rather than the name it came with: two customers attaching
    // "screenshot.png" must not land on each other, and a name from outside
    // must not choose where it goes.
    const name = `${randomBytes(12).toString("hex")}.${UPLOAD_TYPES[file.type]}`;
    await writeFile(join(folder, name), bytes);
    stored.push({
      path: `ticket-attachments/${panelId}/${name}`,
      mime: file.type,
      size: file.size,
      width,
      height,
      filename: displayName(file.name, file.type),
    });
  }
  return stored;
}
