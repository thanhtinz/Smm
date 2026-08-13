"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/icons";

/**
 * Two ways to place the same thing, so they are tabs rather than separate
 * pages — switching does not lose what has been typed in the other tab.
 */
export default function OrderTabs({
  tabs,
  children,
}: {
  tabs: { key: string; label: string; icon: IconName }[];
  children: Record<string, React.ReactNode>;
}) {
  const [active, setActive] = useState(tabs[0].key);

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label="Order type" className="flex gap-1.5 rounded-full border border-[var(--border)] p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            type="button"
            aria-selected={active === tab.key}
            aria-controls={`panel-${tab.key}`}
            onClick={() => setActive(tab.key)}
            className={`flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              active === tab.key
                ? "bg-[var(--primary)] text-[var(--primary-fg)]"
                : "muted hover:bg-[var(--surface2)] hover:text-[var(--text)]"
            }`}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`panel-${tab.key}`}
          role="tabpanel"
          hidden={active !== tab.key}
          aria-labelledby={tab.key}
        >
          {children[tab.key]}
        </div>
      ))}
    </div>
  );
}
