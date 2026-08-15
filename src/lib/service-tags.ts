/** The tones a tag may wear, which are the badge styles the panel already has. */
const TONES = new Set(["info", "success", "warning", "danger", "muted"]);

export type ServiceTag = { label: string; tone: string };

/**
 * "Hot:danger, Giá rẻ:success, Ít tụt" into labels and colours.
 *
 * The words are the operator's — this file does not know a vocabulary, and a
 * panel selling something nobody here has heard of can still label it. Only
 * the colour is constrained, to the five the rest of the panel uses, so a
 * typo cannot invent a class name that renders as nothing.
 */
export function parseServiceTags(raw: string): ServiceTag[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.lastIndexOf(":");
      if (colon === -1) return { label: part, tone: "muted" };

      const tone = part.slice(colon + 1).trim().toLowerCase();
      const label = part.slice(0, colon).trim();
      // A colon in the label itself, or a colour nobody defined: keep the
      // whole thing as the label rather than silently eating half of it.
      return TONES.has(tone) && label ? { label, tone } : { label: part, tone: "muted" };
    })
    // Enough to say what is different about a service; more is a wall of
    // colour with no signal left in it.
    .slice(0, 4);
}
