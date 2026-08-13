/**
 * A readable name for a sign-in, from the user agent it arrived with.
 *
 * Deliberately shallow: this is shown to a customer deciding whether they
 * recognise a session, not used for anything the panel branches on. A miss
 * costs a vaguer line on one screen, so the table stays short rather than
 * chasing every string a browser has ever sent.
 */

const BROWSERS: [RegExp, string][] = [
  [/\bEdg\//, "Edge"],
  [/\bOPR\/|\bOpera\b/, "Opera"],
  [/\bSamsungBrowser\//, "Samsung Internet"],
  [/\bCoc[ _]?Coc\b/i, "Cốc Cốc"],
  [/\bFirefox\//, "Firefox"],
  [/\bChrome\//, "Chrome"],
  [/\bSafari\//, "Safari"],
];

const SYSTEMS: [RegExp, string][] = [
  [/\bWindows NT\b/, "Windows"],
  [/\bAndroid\b/, "Android"],
  [/\b(iPhone|iPad|iPod)\b/, "iOS"],
  [/\bMac OS X\b/, "macOS"],
  [/\bCrOS\b/, "ChromeOS"],
  [/\bLinux\b/, "Linux"],
];

function match(pairs: [RegExp, string][], agent: string): string {
  return pairs.find(([pattern]) => pattern.test(agent))?.[1] ?? "";
}

export function describeDevice(userAgent: string, fallback: string): string {
  if (!userAgent.trim()) return fallback;

  const browser = match(BROWSERS, userAgent);
  const system = match(SYSTEMS, userAgent);
  if (browser && system) return `${browser} · ${system}`;
  return browser || system || fallback;
}
