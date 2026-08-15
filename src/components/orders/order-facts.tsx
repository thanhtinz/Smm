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
  tone: "good" | "bad" | "neutral";
  icon: IconName;
};

const TONE: Record<Fact["tone"], { text: string; ring: string }> = {
  good: { text: "text-[var(--success)]", ring: "bg-[color-mix(in_srgb,var(--success)_14%,transparent)]" },
  bad: { text: "text-[var(--danger)]", ring: "bg-[color-mix(in_srgb,var(--danger)_14%,transparent)]" },
  neutral: { text: "text-[var(--accent)]", ring: "bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]" },
};

export default function OrderFacts({ facts }: { facts: Fact[] }) {
  return (
    <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
      {facts.map((fact) => {
        const tone = TONE[fact.tone];
        return (
          // Stacked rather than side by side: four of these share the form
          // column, and a horizontal tile there wraps its label onto three
          // lines and then truncates the answer, which is the one word that
          // had to survive.
          <div key={fact.key} className="surface-2 rounded-xl px-3 py-2.5">
            <span className="flex items-center gap-2">
              <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${tone.ring} ${tone.text}`}>
                <Icon name={fact.icon} size={15} />
              </span>
              <span className="muted min-w-0 text-[0.6rem] leading-tight font-semibold tracking-[0.1em] uppercase">
                {fact.label}
              </span>
            </span>
            <span className={`mt-1.5 block text-sm leading-snug font-semibold ${tone.text}`}>{fact.value}</span>
          </div>
        );
      })}
    </div>
  );
}
