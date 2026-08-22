import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";
import { buildVersion, serviceWorkerSource } from "@/lib/service-worker";

/**
 * The service worker itself.
 *
 * Served from the root so its scope is the whole panel. Each panel is its own
 * hostname, so a worker registered on one is invisible to the others without
 * anything here having to arrange that.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentPanel())) return new NextResponse("Not found", { status: 404 });

  // 404 rather than an empty worker when the switch is off. A registration
  // that fails leaves nothing behind; a worker that installs and does nothing
  // is still a worker somebody has to remove later.
  if (!(await getSetting("pwa.offline"))) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(serviceWorkerSource(await buildVersion()), {
    headers: {
      "Content-Type": "text/javascript; charset=utf-8",
      // The one file that must never be served stale: it is what decides
      // whether a stale anything else is possible.
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
    },
  });
}
