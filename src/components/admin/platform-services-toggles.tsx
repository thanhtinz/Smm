"use client";

import { useState, useTransition } from "react";
import { togglePlatformServicesAction } from "@/app/actions/admin/catalogue";
import PlatformMark from "@/components/platform-mark";
import { Icon } from "@/components/icons";

/**
 * Which platforms are on sale, on the page that answers what the panel is
 * currently doing.
 *
 * These cannot be settings: the registry is a fixed list of keys written at
 * build time, and platforms are rows an operator adds whenever they like. So
 * the switches sit beside the settings form rather than inside it, and each
 * one writes to its own platform immediately — there is nothing to save.
 */

export type PlatformToggleRow = {
  id: string;
  name: string;
  icon: string;
  image: string;
  color: string;
  showServices: boolean;
  /** Already worded by the server, because the count picks the sentence. */
  services: string;
};

export default function PlatformServicesToggles({
  rows,
  labels,
}: {
  rows: PlatformToggleRow[];
  labels: Record<string, string>;
}) {
  // Held here as well as on the server so the switch answers the click rather
  // than the round trip.
  const [state, setState] = useState(() => new Map(rows.map((row) => [row.id, row.showServices])));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const toggle = (row: PlatformToggleRow) => {
    const next = !(state.get(row.id) ?? row.showServices);
    setError("");
    setState((prev) => new Map(prev).set(row.id, next));
    start(async () => {
      const result = await togglePlatformServicesAction(row.id, next);
      if (result.error) {
        setError(result.error);
        setState((prev) => new Map(prev).set(row.id, !next));
      }
    });
  };

  return (
    <section className="card card-pad space-y-3">
      <div>
        <h3 className="font-semibold">{labels.title}</h3>
        <p className="muted mt-1 text-sm leading-relaxed">{labels.summary}</p>
      </div>

      {error && (
        <div className="alert alert-danger" role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="muted py-6 text-center text-sm">{labels.empty}</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {rows.map((row) => {
            const on = state.get(row.id) ?? row.showServices;
            return (
              <li key={row.id} className="flex items-center gap-3 py-2.5">
                <PlatformMark platform={row} box={28} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  <p className="muted text-xs tabular-nums">{row.services}</p>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  disabled={pending}
                  aria-pressed={on}
                  className={`badge ${on ? "badge-success" : "badge-muted"}`}
                >
                  <Icon name={on ? "eye" : "close"} size={11} />
                  {on ? labels.on : labels.off}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
