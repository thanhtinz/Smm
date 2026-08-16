"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import Combobox from "@/components/ui/combobox";

export type PickerService = {
  id: string;
  publicId: number;
  name: string;
  /** Already priced for this customer and formatted for their currency. */
  price: string;
  /** The list price when a tier discount applies, so the saving is visible. */
  wasPrice?: string;
  /** Pre-formatted: this is a client component, so toLocaleString() here
   *  would follow the browser's locale rather than the panel's. */
  limits: string;
  tags: { label: string; tone: string }[];
};

/**
 * Which service — in one of two shapes, because the question is not the same
 * one in both places it is asked.
 *
 * On a category's own page the choice *is* the page. The customer arrived
 * already knowing they want Instagram likes; what is left to decide is which
 * of the cheap one, the fast one and the one that does not drop they want,
 * and that comparison is the whole reason the page exists. So there: cards,
 * side by side, with the price and the badges showing.
 *
 * On the general order form it is the third step of a cascade — platform,
 * then category, then this — and the reader has already made two choices from
 * closed controls. A third one that suddenly unfurls into a wall of cards
 * shoves the rest of the form off the screen, and the details it shows are
 * repeated in the summary beside it the moment anything is picked. So there:
 * a dropdown, matching the two steps above it.
 *
 * `shape` says which. Neither is the fallback for the other.
 *
 * They are radios so a keyboard moves through them with the arrow keys for
 * free — but what the form submits is the hidden input beside them, not the
 * radio. React resets a form once a server action finishes, and a reset
 * unchecks every box and radio in it while the React state that drew them
 * stays put. The screen then disagrees with what the next submit would send:
 * an order refused once would come back refused for having no service at all.
 * A hidden input's value is an attribute, so a reset restores it unchanged.
 */
export default function ServicePicker({
  name,
  services,
  value,
  onChange,
  disabled,
  disabledLabel,
  emptyLabel,
  shape = "cards",
  placeholder,
}: {
  name: string;
  services: PickerService[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** "cards" on a category page, "dropdown" in the cascading order form. */
  shape?: "cards" | "dropdown";
  /** The unchosen state of the dropdown. Unused by the card shape. */
  placeholder?: string;
  /** Why there is nothing to choose from yet. */
  disabledLabel: string;
  emptyLabel: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  // Whether there is anything above or below what is on screen. A capped list
  // with no sign that it is capped reads as a broken card, not as more to
  // come: the fifth service was being sliced through its own name.
  const [more, setMore] = useState({ up: false, down: false });

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const read = () => {
      const room = el.scrollHeight - el.clientHeight;
      setMore({ up: el.scrollTop > 4, down: room > 4 && el.scrollTop < room - 4 });
    };
    read();
    el.addEventListener("scroll", read, { passive: true });
    // The list changes when the category above it does.
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", read);
      observer.disconnect();
    };
    // The count, not the array. The caller maps a fresh array on every render,
    // so depending on the array itself tore down the scroll listener and the
    // ResizeObserver on every keystroke in the quantity field. What this
    // effect actually cares about is the list getting longer or shorter, and
    // the observer catches any resize that is not a length change.
  }, [services.length]);

  if (disabled || services.length === 0) {
    return (
      <p className="surface-2 muted rounded-xl px-3.5 py-3 text-sm">{disabled ? disabledLabel : emptyLabel}</p>
    );
  }

  if (shape === "dropdown") {
    return (
      // The same Combobox the platform step uses, so the three steps of the
      // cascade are one control repeated rather than three different ones. A
      // native <select> was the first attempt and is wrong here for the
      // reason the Combobox exists: a real category runs to dozens of
      // services and a native list cannot be typed at, cannot show the id and
      // the price in their own columns, and concatenates all three into one
      // unreadable line.
      //
      // Everything the cards would have shown beyond the id, the name and the
      // price — limits, warranty, start time, the badges — is in the summary
      // beside the form the moment a service is chosen, so closing the
      // control loses nothing.
      <Combobox
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder ?? ""}
        searchPlaceholder={placeholder ?? ""}
        emptyLabel={emptyLabel}
        options={services.map((service) => ({
          value: service.id,
          label: service.name,
          code: String(service.publicId),
          meta: service.price,
          keywords: service.tags.map((tag) => tag.label).join(" "),
        }))}
      />
    );
  }

  return (
    // A bordered box, so a card cut off at the edge reads as the list
    // continuing rather than as a card that failed to draw.
    <div className="relative rounded-xl border border-[var(--border)] p-2">
      {/* Named here rather than by the wrapping <Field>: the input this group
          submits through is hidden, and a hidden input cannot carry a label.
          Without this a screen reader met an unnamed set of radios on the page
          the panel exists to close orders on. */}
      <div
        ref={box}
        className="max-h-[26rem] space-y-2 overflow-y-auto pr-1"
        role="radiogroup"
        aria-label={placeholder}
      >
      <input type="hidden" name={name} value={value} />
      {services.map((service) => {
        const chosen = service.id === value;
        return (
          <label
            key={service.id}
            className={`flex cursor-pointer gap-3 rounded-xl border px-3.5 py-3 transition-colors ${
              chosen
                ? "border-[var(--primary)] bg-[color-mix(in_srgb,var(--primary)_10%,transparent)]"
                : "surface-2 border-[var(--border)] hover:border-[color-mix(in_srgb,var(--primary)_45%,transparent)]"
            }`}
          >
            <input
              type="radio"
              // A group name so the arrow keys work, deliberately not the one
              // the action reads.
              name={`${name}__choice`}
              value={service.id}
              checked={chosen}
              onChange={() => onChange(service.id)}
              className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
            />

            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="muted shrink-0 font-mono text-xs">#{service.publicId}</span>
                <span className="min-w-0 text-sm leading-snug font-medium">{service.name}</span>
              </span>

              {service.tags.length > 0 && (
                <span className="mt-1.5 flex flex-wrap gap-1">
                  {service.tags.map((tag, i) => (
                    <span key={i} className={`badge badge-${tag.tone} text-[0.68rem]`}>
                      {tag.label}
                    </span>
                  ))}
                </span>
              )}

              <span className="muted mt-1.5 flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-mono font-semibold tabular-nums text-[var(--text)]">{service.price}</span>
                {/* A discount nobody can compare against persuades nobody. */}
                {service.wasPrice && <span className="font-mono line-through">{service.wasPrice}</span>}
                <span>{service.limits}</span>
              </span>
            </span>

            {chosen && (
              <span className="shrink-0 text-[var(--primary)]">
                <Icon name="checkCircle" size={17} />
              </span>
            )}
          </label>
        );
      })}
      </div>

      {/* Fading edges rather than an arrow: they say "there is more this way"
          without claiming a button that does not exist, and they go when the
          list is at its end so a full view is not permanently smudged. */}
      {more.up && (
        <span className="pointer-events-none absolute inset-x-2 top-2 h-6 rounded-t-xl bg-gradient-to-b from-[var(--surface)] to-transparent" />
      )}
      {more.down && (
        <span className="pointer-events-none absolute inset-x-2 bottom-2 h-8 rounded-b-xl bg-gradient-to-t from-[var(--surface)] to-transparent" />
      )}
    </div>
  );
}
