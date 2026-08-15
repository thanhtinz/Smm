"use client";

import { Icon, type IconName } from "@/components/icons";

/**
 * The four things a buyer in this market checks before spending, as tiles.
 *
 * They were previously three small grey pills and a line in a definition list,
 * which is where the eye goes last. A tile each, with the answer in the
 * heavier type, is what every panel this market shops at puts here — and the
 * reason is sound: these are the answers, the form is only the question.
 *
 * A red cross is a real answer, not an error. "No warranty" is something the
 * customer needs to see plainly before ordering, not something softened.
 */
export type Fact = {
  key: string;
  label: string;
  value: string;
  /**
   * What the panel measured, under what the operator promised. Every other
   * panel in this market quotes the promise alone, because it is the only
   * figure they have; this one records each order's timings, so the promise
   * can be shown with its track record beside it.
   */
  note?: string;
  tone: "good" | "bad" | "neutral";
  icon: IconName;
};

const TONE: Record<Fact["tone"], string> = {
  good: "text-[var(--success)]",
  bad: "text-[var(--danger)]",
  neutral: "text-[var(--accent)]",
};

/**
 * Two columns is the floor and three is the ceiling.
 *
 * This row shares a half-width form column, so a quarter of it is about 130px
 * — enough for "Có" and nothing else. Four facts therefore sit two by two
 * rather than in a line: the measured figure under each one needs room to be
 * read, and a tile that has to truncate its answer is a tile that failed.
 * Written out rather than built so Tailwind can see the class names.
 */
const COLUMNS: Record<number, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-2",
};

export default function OrderFacts({ facts }: { facts: Fact[] }) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${COLUMNS[facts.length] ?? "sm:grid-cols-2"}`}>
      {facts.map((fact) => {
        const tone = TONE[fact.tone];
        return (
          <div
            key={fact.key}
            className="surface-2 flex flex-col gap-1.5 rounded-xl border border-[var(--border)] px-3.5 py-3"
          >
            {/* Sentence case, not uppercase with wide tracking: at a quarter of
                the form column that treatment broke every label onto two lines,
                which pushed the four answers onto four different baselines. */}
            <span className="muted truncate text-xs leading-none">{fact.label}</span>

            {/* The mark belongs with the answer, not with the question — a tick
                beside "Có" reinforces it, a tick beside "Huỷ được" only
                decorates. It also drops four tinted chips off the row. */}
            <span className={`flex items-start gap-1.5 text-sm leading-tight font-semibold ${tone}`}>
              <Icon name={fact.icon} size={15} className="mt-px shrink-0" />
              {/* Wraps rather than truncates. The answer is the one word on
                  this tile that has to survive — "Đang b…" is worse than two
                  lines, and it is what the previous layout did. */}
              <span className="min-w-0">{fact.value}</span>
            </span>

            {fact.note && <span className="muted text-[0.7rem] leading-snug">{fact.note}</span>}
          </div>
        );
      })}
    </div>
  );
}
