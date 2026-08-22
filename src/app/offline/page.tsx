import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAppContext } from "@/lib/context";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";
import { Icon } from "@/components/icons";
import RetryButton from "@/components/pwa/retry-button";

/**
 * The one page the service worker keeps a copy of.
 *
 * It is precached at install time and served whenever a navigation cannot
 * reach the network, so it has to hold true for any reader on any day: no
 * name, no balance, no ticket count, nothing that was true only when the copy
 * was taken. It says the connection is gone and offers to try again.
 *
 * The panel's own default language rather than the reader's, for the same
 * reason: there is one cached copy and it is taken once.
 */
export const metadata: Metadata = {
  title: "Offline",
  // A page whose entire content is "your connection is gone" has no business
  // in a search index.
  robots: { index: false, follow: false },
};

export default async function OfflinePage() {
  if (!(await getCurrentPanel())) notFound();

  const { t } = await getAppContext();
  const site = String((await getSetting("site.name")) ?? "");

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center">
      <span className="surface-2 flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)]">
        <Icon name="globe" size={28} />
      </span>

      <h1 className="mt-6 text-2xl font-bold tracking-tight">{t("pwa.offlineTitle")}</h1>
      <p className="muted mt-3 text-sm leading-relaxed">{t("pwa.offlineBody", { site })}</p>

      <RetryButton label={t("pwa.retry")} />
    </div>
  );
}
