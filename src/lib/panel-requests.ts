import { db } from "./db";
import { basePrisma } from "./db-base";
import { nextPublicId } from "./ids";
import { getSetting } from "./settings";
import { effectiveMaxDepth, createChildPanel } from "./panels";
import { cloudflareConfig, createZone, readZone, deleteZone, createRecord } from "./cloudflare";
import type { Fault } from "./fault";
import { normaliseHost } from "./tenancy";
import type { Panel } from "@prisma/client";

/**
 * A reseller asking for a panel of their own.
 *
 * The manual route — an operator typing a slug, a hostname and an admin
 * password into a form — is fine for the first reseller and useless for the
 * fiftieth. What resellers in this market expect instead is: give the panel
 * your domain, point its nameservers where you are told, and wait for the
 * operator to say yes.
 *
 * Delegating the nameservers is what makes this safe to automate. A domain
 * can only be delegated by whoever controls it, so once Cloudflare answers
 * for it there is nothing left to prove — no TXT record, no email, no
 * screenshot. The operator's decision is then about the reseller, not about
 * the domain.
 */

export const REQUEST_STATUSES = ["pending", "delegated", "approved", "rejected"] as const;

/**
 * Slug shape, shared with the manual form so the two cannot disagree.
 *
 * The đ is spelled out rather than stripped: NFD leaves it alone, so a panel
 * called "Đại lý" would otherwise slug to "ai-ly".
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

/**
 * A bare registrable domain: `shop.vn`, not `www.shop.vn` and not `shop`.
 *
 * A zone is a whole domain, so a request naming a subdomain would have the
 * panel ask Cloudflare to take on something the reseller cannot delegate.
 * Refusing here says so while they can still fix it.
 */
export function isApexDomain(host: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) && host.split(".").length >= 2 && host.length <= 253;
}

export type RequestDraft = { name: string; slug: string; host: string };

/**
 * Opens a request and, if Cloudflare is configured, takes the domain on.
 *
 * The zone is created now rather than at approval so the reseller has
 * something to do while they wait — and so that by the time the operator
 * looks, the delegation has usually already happened and the decision is one
 * click rather than the start of a correspondence.
 */
export async function openPanelRequest(
  parent: Panel,
  userId: string,
  draft: RequestDraft,
): Promise<{ publicId: number; nameServers: string[] } | Fault> {
  if (!(await getSetting("panel.childrenEnabled"))) return { key: "adm.childrenOff" };
  if (!(await getSetting("panel.selfServeEnabled"))) return { key: "panelReq.closed" };

  const maxDepth = await effectiveMaxDepth(parent);
  if (maxDepth > 0 && parent.depth + 1 > maxDepth) return { key: "adm.depthLimit", vars: { max: maxDepth } };

  const host = normaliseHost(draft.host);
  if (!isApexDomain(host)) return { key: "panelReq.hostShape" };

  const slug = slugify(draft.slug || draft.name);
  if (!slug) return { key: "adm.slugRequired" };
  if (!draft.name.trim()) return { key: "adm.nameRequired" };

  // Taken anywhere in the installation, not just on this panel: a hostname
  // answers for exactly one panel across all of them.
  if (await basePrisma.panelDomain.findUnique({ where: { host } })) return { key: "adm.hostTaken" };
  if (await basePrisma.panel.findUnique({ where: { slug } })) return { key: "adm.slugTaken" };

  const already = await db.panelRequest.findFirst({
    where: { userId, status: { in: ["pending", "delegated"] } },
    select: { publicId: true },
  });
  if (already) return { key: "panelReq.oneAtATime", vars: { id: already.publicId } };

  // Only after every check that can refuse: a zone left behind by a request
  // that was never stored is one nobody will ever clean up.
  const config = await cloudflareConfig();
  let zoneId = "";
  let nameServers: string[] = [];
  let note = "";
  if (config) {
    const zone = await createZone(config, host);
    if (zone.ok) {
      zoneId = zone.data.id;
      nameServers = zone.data.nameServers;
    } else {
      // Not fatal: the operator can still approve and point the domain by
      // hand. What must not happen is losing the request over it.
      note = zone.error;
    }
  }

  const publicId = await nextPublicId("panelRequest");
  await db.panelRequest.create({
    data: { publicId, userId, name: draft.name.trim(), slug, host, zoneId, nameServers: nameServers.join(","), note },
  });

  return { publicId, nameServers };
}

/**
 * Asks Cloudflare whether the delegation has happened yet.
 *
 * Cheap enough to run on a page load, and the reseller is the one waiting, so
 * it is triggered by them looking rather than by a schedule.
 */
export async function refreshDelegation(requestId: string): Promise<{ status: string } | Fault> {
  const request = await db.panelRequest.findFirst({ where: { id: requestId } });
  if (!request) return { key: "panelReq.gone" };
  if (request.status === "approved" || request.status === "rejected") return { status: request.status };
  if (!request.zoneId) return { key: "panelReq.noZone" };

  const config = await cloudflareConfig();
  if (!config) return { key: "panelReq.noCloudflare" };

  const zone = await readZone(config, request.zoneId);
  if (!zone.ok) return { key: "panelReq.zoneRead", vars: { reason: zone.error } };

  const status = zone.data.status === "active" ? "delegated" : "pending";
  await db.panelRequest.update({
    where: { id: request.id },
    data: {
      status,
      // Cloudflare can reassign these while a zone is pending, and a reseller
      // reading yesterday's pair would wait forever.
      nameServers: zone.data.nameServers.join(",") || request.nameServers,
    },
  });
  return { status };
}

/**
 * Turns an approved request into a panel.
 *
 * The DNS record goes into the reseller's own zone rather than the operator's,
 * because it is their domain — the operator is answering for it, not hosting
 * it inside their own.
 */
export async function approvePanelRequest(
  parent: Panel,
  requestId: string,
  admin: { adminUsername: string; adminEmail: string; adminPassword: string },
): Promise<{ panelId: string } | Fault> {
  const request = await db.panelRequest.findFirst({ where: { id: requestId } });
  if (!request) return { key: "panelReq.gone" };
  if (request.status === "approved") return { key: "panelReq.alreadyApproved" };
  if (request.status !== "delegated") return { key: "panelReq.notDelegated" };

  // Re-checked at the moment of approval, not only when it was asked: a
  // hostname or slug can be taken by somebody else in between.
  if (await basePrisma.panelDomain.findUnique({ where: { host: request.host } })) return { key: "adm.hostTaken" };
  if (await basePrisma.panel.findUnique({ where: { slug: request.slug } })) return { key: "adm.slugTaken" };

  const child = await createChildPanel(parent, {
    slug: request.slug,
    name: request.name,
    host: request.host,
    ownerUserId: request.userId,
    ...admin,
  });

  // createChildPanel stores the hostname; this is what makes it answer.
  const config = await cloudflareConfig();
  let recordId = "";
  let note = "";
  if (config && request.zoneId) {
    const target = await primaryHost(parent);
    if (target) {
      const record = await createRecord(config, request.host, target, request.zoneId);
      if (record.ok) recordId = record.data;
      else note = record.error;
    } else {
      note = "This panel has no hostname of its own to point at yet";
    }
  }

  await db.panelDomain.updateMany({
    where: { panelId: child.id, host: request.host },
    data: { verified: recordId !== "" || !config, dnsRecordId: recordId },
  });
  await db.panelRequest.update({
    where: { id: request.id },
    data: { status: "approved", createdPanelId: child.id, note },
  });

  return { panelId: child.id };
}

/** Turns a request down and gives the domain back. */
export async function rejectPanelRequest(requestId: string, reason: string): Promise<{ ok: true } | Fault> {
  const request = await db.panelRequest.findFirst({ where: { id: requestId } });
  if (!request) return { key: "panelReq.gone" };
  if (request.status === "approved") return { key: "panelReq.alreadyApproved" };

  // Keeping the zone would leave the operator's account answering for a
  // domain belonging to somebody they turned down.
  const config = await cloudflareConfig();
  if (config && request.zoneId) await deleteZone(config, request.zoneId);

  await db.panelRequest.update({
    where: { id: request.id },
    data: { status: "rejected", note: reason, zoneId: "" },
  });
  return { ok: true };
}

/** The hostname this panel answers on, which a child's domain points at. */
async function primaryHost(panel: Panel): Promise<string> {
  const domain =
    (await basePrisma.panelDomain.findFirst({ where: { panelId: panel.id, isPrimary: true } })) ??
    (await basePrisma.panelDomain.findFirst({ where: { panelId: panel.id }, orderBy: { createdAt: "asc" } }));
  return domain?.host ?? "";
}
