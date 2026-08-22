/**
 * What the panel looks like once it is installed on a phone.
 *
 * Everything here is derived from settings the operator already fills in —
 * the panel's name, its logo, its theme — so a panel is installable without
 * anyone opening a page about it. The overrides exist because an app icon and
 * a website logo are not always the same picture: a wordmark that reads
 * beautifully in a header is unreadable at 48 pixels on a home screen.
 */

/** Served by the route of the same name; also what the SW is registered as. */
export const MANIFEST_PATH = "/manifest.webmanifest";
export const SERVICE_WORKER_PATH = "/sw.js";
export const GENERATED_ICON_PATH = "/icon.svg";
/** Precached, and the only page the service worker ever answers from cache. */
export const OFFLINE_PATH = "/offline";

export const DISPLAY_MODES = ["standalone", "minimal-ui", "browser"] as const;
export type DisplayMode = (typeof DISPLAY_MODES)[number];

export type ManifestIcon = {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
};

export type WebManifest = {
  name: string;
  short_name: string;
  description?: string;
  start_url: string;
  scope: string;
  display: DisplayMode;
  orientation: "portrait" | "any";
  theme_color: string;
  background_color: string;
  lang: string;
  dir: "ltr" | "rtl";
  icons: ManifestIcon[];
};

export type ManifestInput = {
  siteName: string;
  tagline: string;
  logoText: string;
  /** The operator's overrides. Empty means "use the panel's own branding". */
  appName: string;
  shortName: string;
  iconUrl: string;
  logoUrl: string;
  startUrl: string;
  display: string;
  /** From the panel's default theme, in its default colour mode. */
  primary: string;
  background: string;
  locale: string;
  direction: string;
  /** The uploaded icon's pixel size, when we know it. Zero when we do not. */
  iconWidth?: number;
  iconHeight?: number;
};

/**
 * A short name is what fits under the icon; Android truncates at roughly
 * twelve characters and iOS is not much kinder. Cutting mid-word is worse
 * than cutting at one, so the fallback takes whole words while they fit.
 */
export function shortNameFrom(input: { shortName: string; logoText: string; siteName: string }): string {
  const explicit = input.shortName.trim() || input.logoText.trim();
  if (explicit) return explicit.slice(0, 12);

  const name = input.siteName.trim();
  if (name.length <= 12) return name;

  const words = name.split(/\s+/);
  let out = "";
  for (const word of words) {
    const next = out ? `${out} ${word}` : word;
    if (next.length > 12) break;
    out = next;
  }
  return out || name.slice(0, 12);
}

/**
 * Only a path on this panel may be where the icon opens.
 *
 * A manifest whose start_url points somewhere else is rejected outright by
 * the browser, so a typo here would not be a redirect bug but a panel that
 * silently stops being installable — the worst kind, because nothing on
 * screen says so.
 */
export function safeStartUrl(raw: string): string {
  const value = raw.trim();
  if (!value.startsWith("/")) return "/dashboard";
  // "//host" and "/\host" are both read as another origin by some parsers.
  if (value.startsWith("//") || value.startsWith("/\\")) return "/dashboard";
  // Control characters and spaces: a browser strips or encodes them, and
  // what it ends up asking for is not what the operator meant to say.
  if (/[\u0000-\u0020]/.test(value)) return "/dashboard";
  return value;
}

export function safeDisplay(raw: string): DisplayMode {
  return DISPLAY_MODES.includes(raw as DisplayMode) ? (raw as DisplayMode) : "standalone";
}

/**
 * The icons the manifest offers, best first.
 *
 * An uploaded file is declared as `any`, not as a size we made up: the panel
 * reads a PNG's real dimensions when it is uploaded, and claiming 512×512 for
 * a 64-pixel logo produces a home-screen icon that is blurry in a way nobody
 * can explain from the manifest.
 *
 * The generated mark is always offered as well, and always last. It is an SVG,
 * so it is the entry that is sharp at every size a launcher asks for, and it
 * means a panel that has uploaded nothing is still installable.
 */
export function iconsFor(input: ManifestInput): ManifestIcon[] {
  const icons: ManifestIcon[] = [];
  const uploaded = input.iconUrl.trim() || input.logoUrl.trim();

  if (uploaded) {
    const known = input.iconWidth && input.iconHeight && input.iconWidth > 0 && input.iconHeight > 0;
    icons.push({
      src: uploaded,
      sizes: known ? `${input.iconWidth}x${input.iconHeight}` : "any",
      // "maskable" is not claimed for a file we have not seen: a launcher
      // trusts it and crops to a circle, and a wordmark loses its ends.
      purpose: "any",
    });
  }

  icons.push({ src: GENERATED_ICON_PATH, sizes: "any", type: "image/svg+xml", purpose: "any" });
  // The same mark again, this time promised to survive a circular crop — it
  // is drawn with that in mind, unlike anything uploaded.
  icons.push({ src: GENERATED_ICON_PATH, sizes: "any", type: "image/svg+xml", purpose: "maskable" });

  return icons;
}

export function buildManifest(input: ManifestInput): WebManifest {
  const name = input.appName.trim() || input.siteName.trim() || "Panel";

  return {
    name,
    short_name: shortNameFrom(input),
    ...(input.tagline.trim() ? { description: input.tagline.trim() } : {}),
    start_url: safeStartUrl(input.startUrl),
    // The whole panel, so following a link out of the installed app — to a
    // blog post, to the API docs — stays inside it rather than throwing the
    // reader into a browser tab.
    scope: "/",
    display: safeDisplay(input.display),
    // Phones, held the way phones are held. "any" would let a launcher open
    // it sideways on a tablet, which none of these screens are drawn for.
    orientation: "portrait",
    theme_color: input.primary,
    background_color: input.background,
    lang: input.locale,
    dir: input.direction === "rtl" ? "rtl" : "ltr",
    icons: iconsFor(input),
  };
}

/**
 * The mark drawn when nobody has uploaded one: the panel's initials on its own
 * primary colour.
 *
 * The colour fills the canvas edge to edge and the letters sit in the middle,
 * which is what "maskable" requires: this is the one icon the manifest
 * promises a launcher may crop to a circle, and anything reaching the corners
 * loses its ends when it does.
 */
export function generatedIcon(text: string, primary: string, foreground: string): string {
  const initials = initialsFrom(text);
  // Two letters need more room than one; sized so both fill the same box.
  const fontSize = initials.length > 1 ? 210 : 300;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" role="img" aria-label="${escapeXml(text)}">
  <rect width="512" height="512" fill="${escapeXml(primary)}"/>
  <text x="256" y="256" fill="${escapeXml(foreground)}" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="${fontSize}" font-weight="700" text-anchor="middle" dominant-baseline="central" letter-spacing="-8">${escapeXml(initials)}</text>
</svg>`;
}

/** One letter from each of the first two words, upper case. */
export function initialsFrom(text: string): string {
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w));
  if (words.length === 0) return "•";
  if (words.length === 1) return [...words[0]].slice(0, 2).join("").toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => [...w][0])
    .join("")
    .toUpperCase();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
