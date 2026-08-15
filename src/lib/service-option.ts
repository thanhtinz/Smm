import type { ServiceOption } from "@/components/orders/new-order-form";
import type { ServiceStats } from "@/lib/service-stats";
import type { Translator } from "@/lib/i18n";

/** Everything the order form needs off a Service row. */
export type ServiceRow = {
  id: string;
  publicId: number;
  name: string;
  categoryId: string;
  rate: number;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  dripfeed: boolean;
  type: string;
  target: string;
  averageTime: string;
  description: string;
  warrantyDays: number;
  startMinutes: number;
  speedPerDay: number;
};

export type LinkExamples = { postExample?: string | null; profileExample?: string | null } | null;

/**
 * One Service row, as the order form wants it.
 *
 * Three pages render that form, and each was spelling this mapping out. They
 * disagreed the moment the model grew — the type caught it, but only after the
 * third copy had already been written. One function now, and a new column is
 * one edit.
 */
export function toServiceOption(
  service: ServiceRow,
  options: {
    /** What this customer pays, after their tier discount. */
    rate?: number;
    /** The platform's link rules, for the placeholder. */
    links: LinkExamples;
    stats?: ServiceStats;
    t: Translator;
  },
): ServiceOption {
  const { rate, links, stats, t } = options;

  return {
    id: service.id,
    publicId: service.publicId,
    name: service.name,
    categoryId: service.categoryId,
    linkExample: (service.target === "profile" ? links?.profileExample : links?.postExample) ?? "",
    rate: rate ?? service.rate,
    listRate: service.rate,
    min: service.min,
    max: service.max,
    refill: service.refill,
    cancel: service.cancel,
    dripfeed: service.dripfeed,
    type: service.type,
    averageTime: service.averageTime,
    description: service.description,
    warrantyDays: service.warrantyDays,
    startMinutes: service.startMinutes,
    speedPerDay: service.speedPerDay,
    measured: measuredWords(stats, t),
  };
}

/**
 * The measured figures, already worded.
 *
 * Worded here rather than in the form because the form is a client component
 * and this needs the reader's dictionary. Nothing is said where there is not
 * enough to say it — a service with eight finished orders has no track record,
 * and inventing one from eight is how a measured number becomes another
 * claim.
 */
function measuredWords(stats: ServiceStats | undefined, t: Translator): ServiceOption["measured"] {
  if (!stats || stats.sample === 0) return undefined;

  const n = stats.sample;
  const out: NonNullable<ServiceOption["measured"]> = {};
  if (stats.startMinutes !== null) out.start = t("service.measuredStart", { value: minutes(stats.startMinutes, t), n });
  if (stats.finishMinutes !== null) out.finish = t("service.measuredFinish", { value: minutes(stats.finishMinutes, t), n });
  if (stats.refillRate !== null) out.refill = t("service.measuredRefill", { percent: stats.refillRate, n });

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Minutes in the reader's words, in hours once that reads better. */
function minutes(value: number, t: Translator): string {
  if (value < 60) return t("time.minutes", { n: value });
  const hours = Math.floor(value / 60);
  const rest = value % 60;
  if (hours < 24) return rest ? t("time.hoursMinutes", { h: hours, m: rest }) : t("time.hours", { n: hours });
  const days = Math.floor(hours / 24);
  return t("time.days", { n: days });
}
