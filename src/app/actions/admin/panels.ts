"use server";

import { randomBytes } from "crypto";
import { resolveTxt } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { currentPanelId, normaliseHost, runAsPanel } from "@/lib/tenancy";
import { createChildPanel, effectiveMaxDepth, subtreeOf } from "@/lib/panels";
import type { ActionResult } from "./catalogue";

export type { ActionResult };

function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Rejects anything that is not a plain hostname — no scheme, path or port. */
function validHost(host: string) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host);
}

async function currentPanel() {
  const id = await currentPanelId();
  return db.panel.findUniqueOrThrow({ where: { id } });
}

export async function createChildPanelAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parent = await currentPanel();

  if (!(await getSetting("panel.childrenEnabled"))) {
    return { error: "Child panels are switched off for this panel." };
  }

  // maxDepth counts levels of child panels below the root, so the root itself
  // is level 0 and a limit of 3 allows root -> child -> grandchild -> great.
  const maxDepth = await effectiveMaxDepth(parent);
  if (maxDepth > 0 && parent.depth + 1 > maxDepth) {
    return { error: `Child panels are limited to ${maxDepth} level${maxDepth === 1 ? "" : "s"}.` };
  }

  const maxChildren = Number(await getSetting("panel.maxChildren")) || 0;
  if (maxChildren > 0) {
    const existing = await db.panel.count({ where: { parentId: parent.id } });
    if (existing >= maxChildren) return { error: `This panel may create at most ${maxChildren} child panels.` };
  }

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: "Enter a name" } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || name);
  if (!slug) return { fieldErrors: { slug: "Enter a slug" } };
  if (await db.panel.findUnique({ where: { slug } })) {
    return { fieldErrors: { slug: "That slug is already taken" } };
  }

  const host = normaliseHost(String(form.get("host") ?? ""));
  if (!validHost(host)) return { fieldErrors: { host: "Enter a hostname, e.g. panel.example.com" } };
  if (await db.panelDomain.findUnique({ where: { host } })) {
    return { fieldErrors: { host: "Another panel already answers on that hostname" } };
  }

  // The owner is a customer of THIS panel: their balance is what rent and
  // wholesale are charged against.
  const ownerUserId = String(form.get("ownerUserId") ?? "");
  const owner = await db.user.findUnique({ where: { id: ownerUserId } });
  if (!owner) return { fieldErrors: { ownerUserId: "Pick an account on this panel" } };

  const adminUsername = String(form.get("adminUsername") ?? "").trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(adminUsername)) {
    return { fieldErrors: { adminUsername: "3-32 characters, letters, numbers, dot, dash or underscore" } };
  }
  const adminEmail = String(form.get("adminEmail") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    return { fieldErrors: { adminEmail: "Enter an email address" } };
  }
  const adminPassword = String(form.get("adminPassword") ?? "");
  if (adminPassword.length < 8) {
    return { fieldErrors: { adminPassword: "At least 8 characters" } };
  }

  const child = await createChildPanel(parent, {
    slug,
    name,
    host,
    ownerUserId: owner.id,
    adminUsername,
    adminEmail,
    adminPassword,
  });

  await logActivity(admin.id, "admin.panel.create", `${child.slug} (${host})`);
  revalidatePath("/admin/panels");
  return { ok: true };
}

/**
 * Suspending takes the whole subtree with it: a panel whose parent is off
 * cannot buy from it, so leaving grandchildren serving would sell orders that
 * can never be fulfilled.
 */
export async function setPanelStatusAction(id: string, status: "active" | "suspended"): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const child = await db.panel.findUnique({ where: { id } });
  if (!child || !child.path.startsWith(`${parent.path}/`)) return { error: "Panel not found" };

  const subtree = await subtreeOf(child);
  await db.panel.updateMany({
    where: { id: { in: subtree.map((p) => p.id) } },
    data: { status, statusNote: status === "suspended" ? `Suspended by ${parent.slug}` : "" },
  });

  await logActivity(admin.id, `admin.panel.${status}`, `${child.slug} (+${subtree.length - 1} below)`);
  revalidatePath("/admin/panels");
  return { ok: true };
}

/**
 * Sets what one child pays, or clears the override so it follows this panel's
 * standard price again.
 */
export async function setPanelRentAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const panelId = String(form.get("panelId") ?? "");
  const child = await db.panel.findUnique({ where: { id: panelId } });
  if (!child || !child.path.startsWith(`${parent.path}/`)) return { error: "Panel not found" };

  const raw = String(form.get("rentPrice") ?? "").trim();
  let rentPrice: number | null = null;
  if (raw !== "") {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return { fieldErrors: { rentPrice: "Enter a price" } };
    rentPrice = value;
  }

  // A due date can be moved to give someone extra time, or pulled forward.
  const dueRaw = String(form.get("nextDueAt") ?? "").trim();
  const nextDueAt = dueRaw ? new Date(`${dueRaw}T00:00:00Z`) : child.nextDueAt;
  if (dueRaw && Number.isNaN(nextDueAt?.getTime())) return { fieldErrors: { nextDueAt: "Enter a date" } };

  await db.panel.update({ where: { id: panelId }, data: { rentPrice, nextDueAt } });
  await logActivity(admin.id, "admin.panel.rent", `${child.slug} ${rentPrice ?? "standard"}`);
  revalidatePath("/admin/panels");
  return { ok: true };
}

export async function addPanelDomainAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const panelId = String(form.get("panelId") ?? "");
  const target = await db.panel.findUnique({ where: { id: panelId } });
  const own = panelId === parent.id;
  if (!target || (!own && !target.path.startsWith(`${parent.path}/`))) return { error: "Panel not found" };

  const host = normaliseHost(String(form.get("host") ?? ""));
  if (!validHost(host)) return { fieldErrors: { host: "Enter a hostname, e.g. panel.example.com" } };
  if (await db.panelDomain.findUnique({ where: { host } })) {
    return { fieldErrors: { host: "Another panel already answers on that hostname" } };
  }

  await db.panelDomain.create({
    data: { panelId, host, verified: false, verifyToken: randomBytes(12).toString("hex") },
  });

  await logActivity(admin.id, "admin.panel.domain.add", `${target.slug} ${host}`);
  revalidatePath("/admin/panels");
  return { ok: true };
}

/**
 * Confirms the TXT record the owner was asked to publish.
 *
 * Until this passes the hostname is stored but never served, so pointing
 * someone else's domain at the panel achieves nothing.
 */
export async function verifyPanelDomainAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const domain = await db.panelDomain.findUnique({ where: { id }, include: { panel: true } });
  if (!domain) return { error: "Domain not found" };
  const own = domain.panelId === parent.id;
  if (!own && !domain.panel.path.startsWith(`${parent.path}/`)) return { error: "Domain not found" };
  if (domain.verified) return { ok: true };

  const expected = `nova-panel-verify=${domain.verifyToken}`;
  const record = `_nova-panel.${domain.host}`;

  let records: string[] = [];
  try {
    // A TXT record can be split into several strings; joining them back is
    // what every resolver client has to do.
    records = (await resolveTxt(record)).map((parts) => parts.join(""));
  } catch (error) {
    const code = (error as { code?: string }).code;
    // Nothing published yet is the ordinary case, not a failure to report as
    // a broken resolver.
    if (code === "ENOTFOUND" || code === "ENODATA") {
      return { error: `No TXT record on ${record} yet.` };
    }
    return { error: "Could not read DNS just now. Try again in a moment." };
  }

  if (!records.includes(expected)) {
    return { error: `${record} exists but does not carry this panel's token yet.` };
  }

  await db.panelDomain.update({ where: { id }, data: { verified: true } });
  await logActivity(admin.id, "admin.panel.domain.verify", domain.host);
  revalidatePath("/admin/panels");
  return { ok: true };
}

export async function deletePanelDomainAction(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const domain = await db.panelDomain.findUnique({ where: { id }, include: { panel: true } });
  if (!domain) return { error: "Domain not found" };
  const own = domain.panelId === parent.id;
  if (!own && !domain.panel.path.startsWith(`${parent.path}/`)) return { error: "Domain not found" };

  const remaining = await db.panelDomain.count({ where: { panelId: domain.panelId } });
  if (remaining <= 1) return { error: "A panel needs at least one hostname." };

  await db.panelDomain.delete({ where: { id } });
  await logActivity(admin.id, "admin.panel.domain.delete", domain.host);
  revalidatePath("/admin/panels");
  return { ok: true };
}

/** Resets the admin password of a child panel, for an owner who is locked out. */
export async function resetChildAdminAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const panelId = String(form.get("panelId") ?? "");
  const child = await db.panel.findUnique({ where: { id: panelId } });
  if (!child || !child.path.startsWith(`${parent.path}/`)) return { error: "Panel not found" };

  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { fieldErrors: { password: "At least 8 characters" } };

  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(password, 10);
  const updated = await runAsPanel(child.id, async () =>
    db.user.updateMany({ where: { role: "admin" }, data: { password: hash } }),
  );
  if (updated.count === 0) return { error: "That panel has no admin account." };

  await logActivity(admin.id, "admin.panel.reset", child.slug);
  revalidatePath("/admin/panels");
  return { ok: true };
}
