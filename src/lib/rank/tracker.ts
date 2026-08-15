import { db } from "@/lib/db";
import { basePrisma } from "@/lib/db-base";
import { runAsPanel, panelBaseUrl } from "@/lib/tenancy";
import { getSetting } from "@/lib/settings";
import { activeRankSource, type Ranking } from "./drivers";

/**
 * Checking where the panel ranks, on a schedule.
 *
 * The operator's whole involvement is filling in a source in admin and typing
 * phrases; from then on the scheduler that already dispatches orders also
 * takes the readings. Nothing here is triggered by a page view — a report
 * that only refreshes while somebody is looking at it is not a report.
 */

export type RankReport = { checked: number; keywords: number; error?: string };

/**
 * Reads for one panel, if enough time has passed.
 *
 * `force` is the admin's "check now" button, which skips the interval but
 * nothing else — a source that is off or unconfigured stays that way.
 */
export async function checkPanelRanks(force = false): Promise<RankReport> {
  const source = await activeRankSource();
  if (!source.ok) return { checked: 0, keywords: 0, error: source.reason };

  const keywords = await db.keyword.findMany({ orderBy: { createdAt: "asc" } });
  if (keywords.length === 0) return { checked: 0, keywords: 0 };

  const hours = Number(await getSetting("rank.checkEveryHours")) || 24;
  const cutoff = new Date(Date.now() - hours * 3_600_000);
  // Never-checked rows come first: a phrase added an hour ago should not wait
  // a day for its first reading.
  const due = force ? keywords : keywords.filter((k) => !k.checkedAt || k.checkedAt < cutoff);
  if (due.length === 0) return { checked: 0, keywords: keywords.length };

  const site = await panelBaseUrl();
  const result = await source.driver.fetch(
    source.config,
    due.map((k) => ({ phrase: k.phrase, country: k.country })),
    site,
  );

  if (!result.ok) {
    // Recorded on every row that was asked about, so the operator reads the
    // reason on the screen they are already looking at.
    await db.keyword.updateMany({
      where: { id: { in: due.map((k) => k.id) } },
      data: { lastError: result.error, checkedAt: new Date() },
    });
    return { checked: 0, keywords: keywords.length, error: result.error };
  }

  const byPhrase = new Map<string, Ranking>();
  for (const r of result.rankings) byPhrase.set(r.phrase.toLowerCase(), r);

  let checked = 0;
  for (const keyword of due) {
    const reading = byPhrase.get(keyword.phrase.toLowerCase());
    if (!reading) continue;

    await db.keyword.update({
      where: { id: keyword.id },
      data: {
        // The previous reading only moves when there was one: a row whose
        // first two checks both find nothing should not show a "change".
        lastPosition: keyword.checkedAt ? keyword.position : reading.position,
        position: reading.position,
        url: reading.url,
        checkedAt: new Date(),
        lastError: "",
      },
    });

    // History is only worth a row when the phrase was actually found. A run
    // of zeroes for a phrase nobody ranks for would bury the real readings.
    if (reading.position > 0) {
      await db.keywordRank.create({
        data: {
          keywordId: keyword.id,
          position: reading.position,
          url: reading.url,
          source: source.driver.kind,
        },
      });
    }
    checked += 1;
  }

  return { checked, keywords: keywords.length };
}

/**
 * Every panel, from the scheduler.
 *
 * Unscoped like the other cron passes: a cron request has no host to resolve
 * a panel from, so each panel is entered explicitly. A child panel with its
 * own domain has its own rankings to track and its own key to pay for.
 */
export async function checkDueRanks(): Promise<{ panels: number; checked: number; failures: string[] }> {
  const panels = await basePrisma.panel.findMany({ where: { status: "active" } });

  let touched = 0;
  let checked = 0;
  const failures: string[] = [];

  for (const panel of panels) {
    const report = await runAsPanel(panel.id, () => checkPanelRanks());
    if (report.error && !["off", "noSource"].includes(report.error) && !report.error.startsWith("missing:")) {
      failures.push(`${panel.slug}: ${report.error}`);
    }
    if (report.checked > 0) {
      touched += 1;
      checked += report.checked;
    }
  }

  return { panels: touched, checked, failures };
}

/** The last N readings for one phrase, oldest first, for a sparkline. */
export async function rankHistory(keywordId: string, take = 30) {
  const rows = await db.keywordRank.findMany({
    where: { keywordId },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.reverse();
}
