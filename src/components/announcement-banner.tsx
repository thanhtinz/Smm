"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

export type Announcement = { id: string; title: string; body: string; level: string };

const ICONS: Record<string, "info" | "checkCircle" | "alert"> = {
  info: "info",
  success: "checkCircle",
  warning: "alert",
  danger: "alert",
};

/**
 * Panel-wide notices.
 *
 * Dismissal is kept in the browser rather than the database: it is a per-device
 * reading preference, not a fact about the account, and storing it would mean a
 * row per customer per notice for something nobody will ever query.
 */
export default function AnnouncementBanner({ items, closeLabel }: { items: Announcement[]; closeLabel: string }) {
  const [dismissed, setDismissed] = useState<string[]>([]);

  // Read after mount: the server has no idea what this browser has seen, and
  // rendering the difference during hydration would flash.
  useEffect(() => {
    try {
      setDismissed(JSON.parse(localStorage.getItem("nova_seen_notices") ?? "[]") as string[]);
    } catch {
      setDismissed([]);
    }
  }, []);

  const visible = items.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  const close = (id: string) => {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      localStorage.setItem("nova_seen_notices", JSON.stringify(next.slice(-50)));
    } catch {
      // A browser refusing storage still gets to close it for this page.
    }
  };

  return (
    <div className="space-y-2">
      {visible.map((a) => (
        <div key={a.id} className={`alert alert-${a.level === "danger" ? "danger" : a.level}`} role="status">
          <Icon name={ICONS[a.level] ?? "info"} size={16} />
          <span className="min-w-0 flex-1">
            <strong className="font-semibold">{a.title}</strong> {a.body}
          </span>
          <button type="button" onClick={() => close(a.id)} className="btn btn-ghost btn-sm" aria-label={closeLabel}>
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
