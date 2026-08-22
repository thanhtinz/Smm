import { NextResponse } from "next/server";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";
import { panelTheme } from "@/lib/pwa-server";
import { generatedIcon } from "@/lib/pwa";

/**
 * The app icon a panel has when nobody has uploaded one: its initials on its
 * own primary colour.
 *
 * Drawn rather than shipped as a file, because there is no one file to ship —
 * every panel on the deployment has a different name and a different palette,
 * and an icon that showed the root panel's colours on a reseller's phone would
 * be worse than no icon at all.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentPanel())) return new NextResponse("Not found", { status: 404 });

  const [logoText, siteName, theme] = await Promise.all([
    getSetting("site.logoText"),
    getSetting("site.name"),
    panelTheme(),
  ]);

  const svg = generatedIcon(
    String(logoText || "") || String(siteName || "Panel"),
    theme.primary,
    theme.foreground,
  );

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // Same short window as the manifest: both are built from settings the
      // operator edits and expects to see change.
      "Cache-Control": "public, max-age=300",
    },
  });
}
