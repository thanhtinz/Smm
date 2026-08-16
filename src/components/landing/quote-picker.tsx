"use client";

import { formatAmount } from "@/lib/money";
import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/icons";
import PlatformMark from "@/components/platform-mark";
import type { PickableService, PlatformLine } from "@/lib/landing";

/**
 * Money for the client side.
 *
 * The currency module reaches for the database, so it cannot cross into the
 * browser; the calculator needs the few fields that actually do the
 * formatting and nothing else.
 */
export type Money = { rate: number; symbol: string; symbolBefore: boolean; decimals: number;
  numberFormat: string; locale: string };

export function money(amountInBase: number, m: Money) {
  return formatAmount(amountInBase * (m.rate || 1), m);
}

/** Plain counts, grouped the way the reader's language groups them. */
function count(n: number, m: Money) {
  return new Intl.NumberFormat(m.locale === "vi" ? "vi-VN" : m.locale).format(n);
}

export type QuoteLabels = {
  category: string;
  service: string;
  quantity: string;
  charge: string;
  start: string;
  browse: string;
};

/**
 * A quote, before signing up.
 *
 * Panels in this market answer "how much" in a support chat. This asks the
 * three questions the order form asks, in the same order, and prints the
 * number — so the visitor arrives at registration already knowing the price.
 */
export default function QuotePicker({
  platforms,
  picks,
  labels,
  m,
}: {
  platforms: PlatformLine[];
  picks: PickableService[];
  labels: QuoteLabels;
  m: Money;
}) {
  const [platformId, setPlatformId] = useState(platforms[0]?.id ?? "");
  const platform = platforms.find((p) => p.id === platformId) ?? platforms[0];

  const [categoryId, setCategoryId] = useState(platform?.categories[0]?.id ?? "");
  const category = platform?.categories.find((c) => c.id === categoryId) ?? platform?.categories[0];

  const inCategory = useMemo(
    () => picks.filter((s) => s.categoryId === category?.id),
    [picks, category?.id],
  );
  const [serviceId, setServiceId] = useState("");
  const service = inCategory.find((s) => s.id === serviceId) ?? inCategory[0];

  const [quantity, setQuantity] = useState<string>("");
  const qty = Number(quantity) || service?.min || 0;
  const charge = service ? (service.rate * qty) / 1000 : 0;
  const outOfRange = Boolean(service && (qty < service.min || qty > service.max));

  // Choosing a platform invalidates the category, and a category invalidates
  // the service — the cascade is the point, so it resets rather than keeping
  // a selection that no longer belongs to what is above it.
  function pickPlatform(id: string) {
    const next = platforms.find((p) => p.id === id);
    setPlatformId(id);
    setCategoryId(next?.categories[0]?.id ?? "");
    setServiceId("");
    setQuantity("");
  }

  function pickCategory(id: string) {
    setCategoryId(id);
    setServiceId("");
    setQuantity("");
  }

  return (
    <div className="card overflow-hidden">
      <div className="border-b border-[var(--border)]">
        {/* Wrapping rather than scrolling: a platform hidden off the right
            edge is a platform the visitor does not know is for sale. */}
        <div className="flex flex-wrap gap-1 p-2">
          {platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pickPlatform(p.id)}
              aria-pressed={p.id === platform?.id}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                p.id === platform?.id ? "bg-[var(--surface2)] text-[var(--text)]" : "muted hover:text-[var(--text)]"
              }`}
            >
              <PlatformMark platform={p} size={17} />
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label htmlFor="q-cat" className="muted mb-1.5 block text-xs font-semibold tracking-wide uppercase">
            {labels.category}
          </label>
          <select
            id="q-cat"
            className="field"
            value={category?.id ?? ""}
            onChange={(e) => pickCategory(e.target.value)}
          >
            {platform?.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="q-svc" className="muted mb-1.5 block text-xs font-semibold tracking-wide uppercase">
            {labels.service}
          </label>
          <select
            id="q-svc"
            className="field"
            value={service?.id ?? ""}
            onChange={(e) => {
              setServiceId(e.target.value);
              setQuantity("");
            }}
          >
            {inCategory.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="q-qty" className="muted mb-1.5 block text-xs font-semibold tracking-wide uppercase">
            {labels.quantity}
          </label>
          <input
            id="q-qty"
            type="number"
            inputMode="numeric"
            className="field"
            value={quantity}
            placeholder={service ? String(service.min) : ""}
            onChange={(e) => setQuantity(e.target.value)}
            aria-invalid={outOfRange || undefined}
          />
          {service && (
            <p className="muted mt-1.5 font-mono text-xs">
              {count(service.min, m)} – {count(service.max, m)}
            </p>
          )}
        </div>

        <div>
          <span className="muted mb-1.5 block text-xs font-semibold tracking-wide uppercase">{labels.charge}</span>
          <p className="font-mono text-4xl leading-none font-bold">{money(charge, m)}</p>
          {service && <p className="muted mt-2 font-mono text-xs">{money(service.rate, m)} / 1000</p>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-[var(--border)] p-5">
        <Link href="/register" className="btn btn-primary btn-lg">
          {labels.start}
          <Icon name="arrowRight" size={17} />
        </Link>
        <Link href={`/services${platform ? `/${platform.slug}` : ""}`} className="btn btn-ghost btn-lg">
          <Icon name="layers" size={17} />
          {labels.browse}
        </Link>
      </div>
    </div>
  );
}
