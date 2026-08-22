"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icons";

/** What Chromium hands over before it shows its own install affordance. */
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * Offers to install the panel, and only when there is something to offer.
 *
 * The browser decides whether a panel is installable and tells us by firing
 * one event; until it does there is nothing to show, so this renders nothing
 * rather than a button that would explain it cannot do anything. Safari never
 * fires it at all — installing there is a menu item the reader finds
 * themselves — and a button that did nothing on iPhone would be worse than no
 * button on a panel whose customers are mostly on phones.
 */
export default function InstallButton({ label }: { label: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    // Already installed: the app is running in its own window, so offering to
    // install it again is offering nothing.
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const onPrompt = (event: Event) => {
      // Kept rather than let through, so the offer sits where the panel put it
      // instead of in whatever bar the browser would have chosen.
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    };
    const onInstalled = () => setPrompt(null);

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!prompt) return null;

  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm w-full"
      onClick={async () => {
        await prompt.prompt();
        // Spent either way: the event cannot be used twice, and leaving the
        // button up after a refusal is asking a second time.
        await prompt.userChoice;
        setPrompt(null);
      }}
    >
      <Icon name="download" size={14} />
      {label}
    </button>
  );
}
