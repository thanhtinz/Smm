import sanitizeHtml from "sanitize-html";

/**
 * What an operator is allowed to publish.
 *
 * Blog posts and static pages are written in the admin area and rendered into
 * a public page with `dangerouslySetInnerHTML`, which is fine while the author
 * and the panel's owner are the same person. They stop being the same person
 * the moment child panels are switched on: `requireAdmin` is satisfied by a
 * child panel's admin, and what they write is served by the parent's
 * deployment. So the content is narrowed to the tags that make an article and
 * nothing that makes a program.
 *
 * The editor in the admin area is the comfortable way to produce this; it is
 * not what makes it safe. A server action takes whatever is POSTed to it, with
 * or without a browser, so the filtering happens here — on the way into the
 * database, once, for every writer.
 *
 * Hand-written filters for this are famously wrong, so the work is done by
 * `sanitize-html` and this file only states the policy.
 */

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "h2",
  "h3",
  "h4",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/**
 * `style` and `class` are left out on purpose. They carry no meaning the
 * article needs and they are the two attributes that let written content
 * reach outside its own box and repaint the page around it.
 */
const ALLOWED_ATTRIBUTES: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "title", "target", "rel"],
  img: ["src", "alt", "width", "height"],
  td: ["colspan", "rowspan"],
  th: ["colspan", "rowspan", "scope"],
};

/**
 * Everything else — `javascript:`, `data:`, `vbscript:` — is dropped rather
 * than escaped, so a link that cannot be followed safely is simply not a link.
 * A relative path is allowed because that is what the panel's own uploads are.
 */
const ALLOWED_SCHEMES = ["http", "https", "mailto"];

export function sanitiseRichText(html: string): string {
  if (!html.trim()) return "";

  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ALLOWED_SCHEMES,
    allowedSchemesAppliedToAttributes: ["href", "src"],
    allowProtocolRelative: false,
    // A tag that is not allowed loses its markup, not its words: dropping the
    // text as well would quietly delete a paragraph an operator had written
    // because they wrapped it in a <div>.
    nonTextTags: ["script", "style", "textarea", "option", "noscript"],
    // Lifting a list out of the paragraph the editor wrapped it in leaves the
    // empty paragraph behind, and an empty paragraph is a blank gap in the
    // article. An <img> or <hr> is empty on purpose and stays.
    exclusiveFilter: (frame) =>
      ["p", "h2", "h3", "h4", "blockquote", "li"].includes(frame.tag) &&
      !frame.text.trim() &&
      !frame.mediaChildren.length,
    transformTags: {
      // A link out of the panel opens without handing the opener a reference
      // back to this window, and without passing the panel's ranking on.
      a: (tagName, attribs) => {
        const href = attribs.href ?? "";
        const external = /^https?:\/\//i.test(href);
        return {
          tagName,
          attribs: external
            ? {
                ...attribs,
                target: "_blank",
                rel: "noopener noreferrer nofollow",
              }
            : attribs,
        };
      },
    },
  });
}
