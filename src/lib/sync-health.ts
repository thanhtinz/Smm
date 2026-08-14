import { basePrisma } from "./db-base";
import { getSetting } from "./settings";

/**
 * Is the engine running?
 *
 * The scheduler is what dispatches orders and pulls statuses back. When it
 * stops — an expired cron job, a moved server, a changed CRON_SECRET — the
 * panel keeps taking orders and money and quietly delivers nothing. Revenue
 * on the overview page looks fine right up until the tickets arrive.
 *
 * So this is deliberately the one number on that page that can be red.
 */

export type SyncHealth = {
  /** Null when the scheduler has never called at all. */
  lastAt: Date | null;
  /** Minutes since it last started a cycle. */
  ageMinutes: number | null;
  /** True when nothing has run inside the operator's window. */
  stale: boolean;
  /** True when the newest run opened and never closed — it died mid-cycle. */
  unfinished: boolean;
  failures: string[];
  dispatched: number;
  synced: number;
  trigger: string;
};

export async function syncHealth(): Promise<SyncHealth> {
  const [last, limit] = await Promise.all([
    basePrisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    getSetting("sync.staleAfterMinutes"),
  ]);

  const window = Number(limit) || 0;

  if (!last) {
    return {
      lastAt: null,
      ageMinutes: null,
      // Never having run is the worst case, not a neutral one — but only once
      // the operator has asked to be warned at all.
      stale: window > 0,
      unfinished: false,
      failures: [],
      dispatched: 0,
      synced: 0,
      trigger: "",
    };
  }

  const ageMinutes = Math.floor((Date.now() - last.startedAt.getTime()) / 60_000);

  return {
    lastAt: last.startedAt,
    ageMinutes,
    stale: window > 0 && ageMinutes > window,
    // A run in flight is normal for a few seconds; one still open long after
    // the window is not.
    unfinished: last.finishedAt === null && window > 0 && ageMinutes > window,
    failures: last.failures ? last.failures.split("\n").filter(Boolean) : [],
    dispatched: last.dispatched,
    synced: last.synced,
    trigger: last.trigger,
  };
}
