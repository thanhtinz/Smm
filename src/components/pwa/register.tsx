"use client";

import { useEffect } from "react";
import { SERVICE_WORKER_PATH } from "@/lib/pwa";

/**
 * Registers the service worker — and, just as importantly, removes it.
 *
 * A worker is the one thing a panel installs on somebody else's device that
 * outlives the visit. Switching the feature off in the admin area has to reach
 * the phones that already have one, or the switch only ever applies to people
 * who have not been here yet. So the off path is not "stop registering": it
 * tells the worker to drop its caches and unregister itself, then unregisters
 * anything left.
 */
export default function RegisterServiceWorker({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (!enabled) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          // Asking it to clean up first: unregistering a worker leaves the
          // caches it opened behind, and those are what would still be served
          // from if it were ever registered again.
          registration.active?.postMessage("nova-uninstall");
          registration.unregister();
        }
      });
      return;
    }

    // After load rather than during it. Registering competes with the
    // page's own requests for the connection, and the first visit — the one
    // where there is no worker yet — is the visit where that is most felt.
    const register = () => {
      navigator.serviceWorker.register(SERVICE_WORKER_PATH, { scope: "/" }).catch(() => {
        // A refused registration is not something the reader can act on, and
        // the panel works without it. It is not worth a message on screen.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, [enabled]);

  return null;
}
