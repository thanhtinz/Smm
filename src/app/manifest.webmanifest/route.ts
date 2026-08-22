import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { getCurrentPanel } from "@/lib/tenancy";
import { panelTheme } from "@/lib/pwa-server";
import { buildManifest } from "@/lib/pwa";

/**
 * The panel's web app manifest, per panel, resolved from the request host.
 *
 * A route rather than Next's `app/manifest.ts` because that is generated once
 * at build time: on a deployment serving several panels it would hand every
 * child the root's name, colours and icon, which is the one thing a manifest
 * must never get wrong.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getCurrentPanel())) return new NextResponse("Not found", { status: 404 });

  // Off means there is no manifest at all, not an empty one. A manifest that
  // parses is a manifest a browser offers to install.
  if (!(await getSetting("pwa.enabled"))) return new NextResponse("Not found", { status: 404 });

  const [siteName, tagline, logoText, logoUrl, appName, shortName, iconUrl, startUrl, display, locale, theme] =
    await Promise.all([
      getSetting("site.name"),
      getSetting("site.tagline"),
      getSetting("site.logoText"),
      getSetting("site.logoUrl"),
      getSetting("pwa.name"),
      getSetting("pwa.shortName"),
      getSetting("pwa.iconUrl"),
      getSetting("pwa.startUrl"),
      getSetting("pwa.display"),
      getSetting("locale.default"),
      panelTheme(),
    ]);

  const chosen = String(iconUrl || "") || String(logoUrl || "");

  const manifest = buildManifest({
    siteName: String(siteName ?? ""),
    tagline: String(tagline ?? ""),
    logoText: String(logoText ?? ""),
    appName: String(appName ?? ""),
    shortName: String(shortName ?? ""),
    iconUrl: String(iconUrl ?? ""),
    logoUrl: String(logoUrl ?? ""),
    startUrl: String(startUrl ?? ""),
    display: String(display ?? ""),
    primary: theme.primary,
    background: theme.background,
    locale: String(locale || "en"),
    direction: theme.direction,
    ...(await uploadedSize(chosen)),
  });

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      // Short, because it is assembled from settings an operator edits and
      // expects to see take effect. A browser re-reads the manifest rarely
      // enough that this costs nothing.
      "Cache-Control": "public, max-age=300",
    },
  });
}

/**
 * The real pixel size of an uploaded icon, read from the row written when it
 * was uploaded rather than guessed from the URL. Nothing when the URL points
 * at something this panel did not upload.
 */
async function uploadedSize(url: string): Promise<{ iconWidth?: number; iconHeight?: number }> {
  const path = url.replace(/^\//, "");
  if (!path.startsWith("uploads/")) return {};

  const media = await db.media.findFirst({ where: { path }, select: { width: true, height: true } });
  if (!media || media.width < 1 || media.height < 1) return {};
  return { iconWidth: media.width, iconHeight: media.height };
}
