import { getSetting } from "./settings";
import { getCurrentUser } from "./auth";

/**
 * Maintenance mode.
 *
 * Staff are let through, and deliberately so: the reason to put a panel into
 * maintenance is usually to fix something, which needs someone able to look
 * at it. Everyone else sees the notice instead of the page.
 *
 * The cron endpoint is not gated either. Orders already at a provider keep
 * being tracked and refunded while the shop front is closed — maintenance
 * stops new business, not work already paid for.
 */

export type Maintenance = { on: true; message: string } | { on: false };

export async function maintenanceState(): Promise<Maintenance> {
  if (!(await getSetting("maintenance.enabled"))) return { on: false };

  const user = await getCurrentUser();
  if (user && (user.role === "admin" || user.role === "support")) return { on: false };

  return { on: true, message: String(await getSetting("maintenance.message")) };
}
