/**
 * Host helpers shared by the Edge middleware and the Node runtime. Kept free
 * of any Node or Prisma import so middleware can bundle it.
 */

/** Stamped by middleware so the resolved host survives into the Node runtime. */
export const PANEL_HOST_HEADER = "x-panel-host";

/** Hosts are compared lowercase and without a port, the way they are stored. */
export function normaliseHost(raw: string): string {
  return raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "");
}
