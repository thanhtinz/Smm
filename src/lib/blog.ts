/**
 * The blog's two small shared pieces.
 *
 * Both the index and the post page need them, and the index is a server
 * component in the public tree while the admin side has its own copy of the
 * raw string — so they live here rather than being written out twice and
 * drifting the first time a separator changes.
 */

/** Comma-separated tags, trimmed and deduplicated, in the order written. */
export function parseTagList(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const name = part.trim();
    if (name) seen.add(name);
  }
  return [...seen];
}

/**
 * The first 155 readable characters of admin-written HTML.
 *
 * Used as a meta description when the post has none of its own. A search
 * result that repeats the site's tagline under every post says nothing about
 * any of them, and the opening of the post itself always says something.
 */
export function summarise(html: string): string {
  const text = html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 155 ? `${text.slice(0, 155).trimEnd()}…` : text;
}
