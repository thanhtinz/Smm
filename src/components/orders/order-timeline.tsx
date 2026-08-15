import { Icon, type IconName } from "@/components/icons";
import { formatCount } from "@/lib/numbers";

export type Step = {
  id: string;
  from: string;
  to: string;
  startCount: number;
  remains: number;
  actor: string;
  note: string;
  at: string;
};

const MARK: Record<string, IconName> = {
  pending: "clock",
  processing: "send",
  inprogress: "refresh",
  completed: "checkCircle",
  partial: "alert",
  canceled: "close",
  refunded: "wallet",
};

/**
 * What actually happened to an order, in order.
 *
 * Support's whole job on a disputed order is answering "when did it start and
 * from what count", and until this existed the answer was whatever the current
 * row happened to say today. The counts are shown as they stood at each step,
 * because a drop is the difference between two of them.
 *
 * Creation is drawn from the order's own timestamp rather than stored as a
 * step: every order starts pending, so a row saying so would carry nothing the
 * order does not already have.
 */
export default function OrderTimeline({
  steps,
  createdAt,
  labels,
  locale,
}: {
  steps: Step[];
  createdAt: string;
  labels: Record<string, string>;
  /** Counts are grouped the reader's way, not the server's. */
  locale: string;
}) {
  return (
    <ol className="space-y-3">
      <li className="flex gap-3">
        <span className="muted mt-0.5 shrink-0">
          <Icon name="plus" size={15} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{labels.created}</p>
          <p className="muted text-xs">{createdAt}</p>
        </div>
      </li>

      {steps.map((s) => (
        <li key={s.id} className="flex gap-3">
          <span className="mt-0.5 shrink-0 text-[var(--primary)]">
            <Icon name={MARK[s.to] ?? "clock"} size={15} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">
              {labels[`status.${s.to}`] ?? s.to}
              <span className="muted font-normal"> · {s.actor}</span>
            </p>
            <p className="muted text-xs">
              {s.at}
              {/* Only where they say something: a step that moved neither
                  count would just be repeating the row above it. */}
              {s.startCount > 0 && ` · ${labels.startCount} ${formatCount(s.startCount, locale)}`}
              {s.remains > 0 && ` · ${labels.remains} ${formatCount(s.remains, locale)}`}
            </p>
            {s.note && <p className="muted mt-0.5 text-xs italic">{s.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
