"use server";

import { randomBytes } from "crypto";
import { cloudflareConfig, createRecord, deleteRecord, insideZone, zoneName } from "@/lib/cloudflare";
import { resolveTxt } from "node:dns/promises";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAdmin, logActivity } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { currentPanelId, normaliseHost, runAsPanel } from "@/lib/tenancy";
import { slugify } from "@/lib/panel-requests";
import { createChildPanel, effectiveMaxDepth, subtreeOf } from "@/lib/panels";
import type { ActionResult } from "./catalogue";
import { readerMessages } from "@/lib/context";

export type { ActionResult };

/** Rejects anything that is not a plain hostname — no scheme, path or port. */
function validHost(host: string) {
  return /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host);
}

async function currentPanel() {
  const id = await currentPanelId();
  return db.panel.findUniqueOrThrow({ where: { id } });
}

export async function createChildPanelAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await currentPanel();

  if (!(await getSetting("panel.childrenEnabled"))) {
    return { error: t("adm.childrenOff") };
  }

  // maxDepth counts levels of child panels below the root, so the root itself
  // is level 0 and a limit of 3 allows root -> child -> grandchild -> great.
  const maxDepth = await effectiveMaxDepth(parent);
  if (maxDepth > 0 && parent.depth + 1 > maxDepth) {
    return { error: t("adm.depthLimit", { max: maxDepth }) };
  }

  const maxChildren = Number(await getSetting("panel.maxChildren")) || 0;
  if (maxChildren > 0) {
    const existing = await db.panel.count({ where: { parentId: parent.id } });
    if (existing >= maxChildren) return { error: t("adm.childLimit", { max: maxChildren }) };
  }

  const name = String(form.get("name") ?? "").trim();
  if (!name) return { fieldErrors: { name: t("adm.nameRequired") } };

  const slug = slugify(String(form.get("slug") ?? "").trim() || name);
  if (!slug) return { fieldErrors: { slug: t("adm.slugRequired") } };
  if (await db.panel.findUnique({ where: { slug } })) {
    return { fieldErrors: { slug: t("adm.slugTaken") } };
  }

  const host = normaliseHost(String(form.get("host") ?? ""));
  if (!validHost(host)) return { fieldErrors: { host: t("adm.hostRequired") } };
  if (await db.panelDomain.findUnique({ where: { host } })) {
    return { fieldErrors: { host: t("adm.hostTaken") } };
  }

  // The owner is a customer of THIS panel: their balance is what rent and
  // wholesale are charged against.
  const ownerUserId = String(form.get("ownerUserId") ?? "");
  const owner = await db.user.findUnique({ where: { id: ownerUserId } });
  if (!owner) return { fieldErrors: { ownerUserId: t("adm.pickAccount") } };

  const adminUsername = String(form.get("adminUsername") ?? "").trim();
  if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(adminUsername)) {
    return { fieldErrors: { adminUsername: t("adm.usernameShape") } };
  }
  const adminEmail = String(form.get("adminEmail") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) {
    return { fieldErrors: { adminEmail: t("adm.emailRequired") } };
  }
  const adminPassword = String(form.get("adminPassword") ?? "");
  if (adminPassword.length < 8) {
    return { fieldErrors: { adminPassword: t("err.passwordLength") } };
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
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const child = await db.panel.findUnique({ where: { id } });
  if (!child || !child.path.startsWith(`${parent.path}/`)) return { error: t("adm.panelMissing") };

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
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const panelId = String(form.get("panelId") ?? "");
  const child = await db.panel.findUnique({ where: { id: panelId } });
  if (!child || !child.path.startsWith(`${parent.path}/`)) return { error: t("adm.panelMissing") };

  const raw = String(form.get("rentPrice") ?? "").trim();
  let rentPrice: number | null = null;
  if (raw !== "") {
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) return { fieldErrors: { rentPrice: t("adm.priceRequired") } };
    rentPrice = value;
  }

  // A due date can be moved to give someone extra time, or pulled forward.
  const dueRaw = String(form.get("nextDueAt") ?? "").trim();
  const nextDueAt = dueRaw ? new Date(`${dueRaw}T00:00:00Z`) : child.nextDueAt;
  if (dueRaw && Number.isNaN(nextDueAt?.getTime())) return { fieldErrors: { nextDueAt: t("adm.dateRequired") } };

  await db.panel.update({ where: { id: panelId }, data: { rentPrice, nextDueAt } });
  await logActivity(admin.id, "admin.panel.rent", `${child.slug} ${rentPrice ?? "standard"}`);
  revalidatePath("/admin/panels");
  return { ok: true };
}

export async function addPanelDomainAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const panelId = String(form.get("panelId") ?? "");
  const target = await db.panel.findUnique({ where: { id: panelId } });
  const own = panelId === parent.id;
  if (!target || (!own && !target.path.startsWith(`${parent.path}/`))) return { error: t("adm.panelMissing") };

  const host = normaliseHost(String(form.get("host") ?? ""));
  if (!validHost(host)) return { fieldErrors: { host: t("adm.hostRequired") } };
  if (await db.panelDomain.findUnique({ where: { host } })) {
    return { fieldErrors: { host: t("adm.hostTaken") } };
  }

  // Inside a zone the operator owns, the panel creates the record itself and
  // the hostname is live immediately — asking the owner to prove control of a
  // domain the panel already controls would be theatre. Everything else keeps
  // the TXT proof.
  const managed = await manageZoneRecord(host);
  if (managed.error) return { fieldErrors: { host: managed.error } };

  await db.panelDomain.create({
    data: {
      panelId,
      host,
      verified: managed.recordId !== "",
      verifyToken: randomBytes(12).toString("hex"),
      dnsRecordId: managed.recordId,
    },
  });

  await logActivity(
    admin.id,
    "admin.panel.domain.add",
    `${target.slug} ${host}${managed.recordId ? " (dns created)" : ""}`,
  );
  revalidatePath("/admin/panels");
  return { ok: true };
}

/**
 * Creates the DNS record when the hostname falls inside the configured zone.
 *
 * A blank record id means the hostname is not this operator's to point — not
 * that anything failed — so the caller falls back to the TXT proof. A real
 * failure is reported, because silently landing an unreachable hostname is
 * worse than refusing to add it.
 */
async function manageZoneRecord(host: string): Promise<{ recordId: string; error?: string }> {
  const t = await readerMessages();
  const config = await cloudflareConfig();
  if (!config) return { recordId: "" };

  const zone = await zoneName(config);
  if (!zone.ok) return { recordId: "", error: zone.error };
  if (!insideZone(host, zone.data)) return { recordId: "" };

  // Everything points at wherever the panel already answers, so moving the
  // app means changing one record rather than one per child.
  const target = await primaryHost();
  if (!target) return { recordId: "", error: t("adm.noPrimaryHost") };
  if (host === target) return { recordId: "" };

  const created = await createRecord(config, host, target);
  return created.ok ? { recordId: created.data } : { recordId: "", error: created.error };
}

/** The hostname the root panel answers on, which children CNAME to. */
async function primaryHost(): Promise<string> {
  const root = await db.panel.findFirst({ where: { parentId: null }, select: { id: true } });
  if (!root) return "";
  const domain =
    (await db.panelDomain.findFirst({ where: { panelId: root.id, isPrimary: true } })) ??
    (await db.panelDomain.findFirst({ where: { panelId: root.id }, orderBy: { createdAt: "asc" } }));
  return domain?.host ?? "";
}

/**
 * Confirms the TXT record the owner was asked to publish.
 *
 * Until this passes the hostname is stored but never served, so pointing
 * someone else's domain at the panel achieves nothing.
 */
export async function verifyPanelDomainAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const domain = await db.panelDomain.findUnique({ where: { id }, include: { panel: true } });
  if (!domain) return { error: t("adm.domainMissing") };
  const own = domain.panelId === parent.id;
  if (!own && !domain.panel.path.startsWith(`${parent.path}/`)) return { error: t("adm.domainMissing") };
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
      return { error: t("adm.dnsNoTxt", { record }) };
    }
    return { error: t("adm.dnsUnreadable") };
  }

  if (!records.includes(expected)) {
    return { error: t("adm.dnsWrongToken", { record }) };
  }

  await db.panelDomain.update({ where: { id }, data: { verified: true } });
  await logActivity(admin.id, "admin.panel.domain.verify", domain.host);
  revalidatePath("/admin/panels");
  return { ok: true };
}

export async function deletePanelDomainAction(id: string): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const domain = await db.panelDomain.findUnique({ where: { id }, include: { panel: true } });
  if (!domain) return { error: t("adm.domainMissing") };
  const own = domain.panelId === parent.id;
  if (!own && !domain.panel.path.startsWith(`${parent.path}/`)) return { error: t("adm.domainMissing") };

  const remaining = await db.panelDomain.count({ where: { panelId: domain.panelId } });
  if (remaining <= 1) return { error: t("adm.hostLast") };

  // Take the DNS record with it, but only one the panel created — a record
  // that was there first belongs to whoever made it.
  if (domain.dnsRecordId) {
    const config = await cloudflareConfig();
    if (config) {
      const removed = await deleteRecord(config, domain.dnsRecordId);
      if (!removed.ok) return { error: t("adm.dnsStillThere", { detail: removed.error }) };
    }
  }

  await db.panelDomain.delete({ where: { id } });
  await logActivity(admin.id, "admin.panel.domain.delete", domain.host);
  revalidatePath("/admin/panels");
  return { ok: true };
}

/** Resets the admin password of a child panel, for an owner who is locked out. */
export async function resetChildAdminAction(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const t = await readerMessages();
  const admin = await requireAdmin();
  const parent = await currentPanel();

  const panelId = String(form.get("panelId") ?? "");
  const child = await db.panel.findUnique({ where: { id: panelId } });
  if (!child || !child.path.startsWith(`${parent.path}/`)) return { error: t("adm.panelMissing") };

  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { fieldErrors: { password: t("err.passwordLength") } };

  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(password, 10);
  const updated = await runAsPanel(child.id, async () =>
    db.user.updateMany({ where: { role: "admin" }, data: { password: hash } }),
  );
  if (updated.count === 0) return { error: t("adm.panelNoAdmin") };

  await logActivity(admin.id, "admin.panel.reset", child.slug);
  revalidatePath("/admin/panels");
  return { ok: true };
}
