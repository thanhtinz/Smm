import { basePrisma } from "./db-base";
import { getSetting } from "./settings";
import { getCurrentPanel } from "./tenancy";

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
  /**
   * Null on a child panel. One cycle covers the whole deployment and the run
   * row records one pair of totals for all of it, so there is no honest number
   * to give a child — showing it the deployment's would be presenting
   * somebody else's work as its own.
   */
  dispatched: number | null;
  synced: number | null;
  trigger: string;
};

/**
 * How the scheduler is doing, told to the panel that is asking.
 *
 * `SyncRun` is deliberately global — one cycle serves every panel — and its
 * `failures` column is the whole deployment's, one line per problem, each
 * prefixed with the slug of the panel it happened on. That column was rendered
 * verbatim on every admin overview, so the admin of one child panel could read
 * "bob-panel: #100482: SmmKings: Not enough funds" and learn a sibling's slug,
 * its order numbers, which suppliers it buys from and how they are behaving.
 *
 * The timing is shared and stays shared: whether the scheduler is running at
 * all is every panel's business. The lines are not.
 */
export async function syncHealth(): Promise<SyncHealth> {
  const [last, limit, panel] = await Promise.all([
    basePrisma.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    getSetting("sync.staleAfterMinutes"),
    getCurrentPanel(),
  ]);
  const isRoot = Boolean(panel && panel.parentId === null);

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
      dispatched: isRoot ? 0 : null,
      synced: isRoot ? 0 : null,
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
    failures: ownFailures(last.failures, isRoot, panel?.slug ?? ""),
    dispatched: isRoot ? last.dispatched : null,
    synced: isRoot ? last.synced : null,
    trigger: last.trigger,
  };
}

/**
 * The lines this panel is entitled to.
 *
 * Per-panel steps prefix their slug; deployment-wide ones — the mail queue,
 * the rank checks, the provider catalogue sync — carry no prefix and belong to
 * the root alone. A child gets its own lines with the prefix stripped, since
 * naming itself back to itself says nothing.
 */
function ownFailures(raw: string, isRoot: boolean, slug: string): string[] {
  const lines = raw ? raw.split("\n").filter(Boolean) : [];
  if (isRoot) return lines;
  if (!slug) return [];
  const prefix = `${slug}: `;
  return lines.filter((line) => line.startsWith(prefix)).map((line) => line.slice(prefix.length));
}
