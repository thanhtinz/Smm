import { Icon } from "@/components/icons";

/**
 * What to know before spending, beside the order form.
 *
 * The words are the operator's, not this file's: a panel selling something
 * this one has never heard of still has to be able to say the right thing.
 * Empty means no card at all rather than an empty box — an empty box reads as
 * a panel that forgot to fill it in, which is worse than no box.
 */
export function OrderNotes({ notes, title }: { notes: string; title: string }) {
  // One note per line, "Heading | what it means". A line with no bar is a
  // note with no heading, which is the right shape for a single blunt warning.
  const items = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const bar = line.indexOf("|");
      return bar === -1
        ? { heading: "", body: line }
        : { heading: line.slice(0, bar).trim(), body: line.slice(bar + 1).trim() };
    });

  if (items.length === 0) return null;

  return (
    <section className="card card-pad">
      <h3 className="flex items-center gap-2 font-semibold">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--warning)_16%,transparent)] text-[var(--warning)]">
          <Icon name="alert" size={15} />
        </span>
        {title}
      </h3>

      <ul className="mt-3 space-y-2">
        {items.map((item, i) => (
          <li key={i} className="surface-2 rounded-xl px-3.5 py-3 text-sm leading-relaxed">
            {item.heading && <span className="block font-semibold">{item.heading}</span>}
            <span className={`muted block ${item.heading ? "mt-0.5" : ""}`}>{item.body}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
