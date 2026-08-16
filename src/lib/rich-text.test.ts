import { describe, expect, it } from "vitest";
import { sanitiseRichText } from "./rich-text";

describe("sanitiseRichText", () => {
  // The reason this exists: a child panel's admin satisfies requireAdmin, and
  // what they publish is served by the parent's deployment. Each case below is
  // a way to turn an article into a program.
  it("drops a script tag and its contents", () => {
    expect(sanitiseRichText('<p>Hi</p><script>alert(1)</script>')).toBe("<p>Hi</p>");
  });

  it("drops event handlers while keeping the element", () => {
    expect(sanitiseRichText('<img src="/a.png" alt="a" onerror="alert(1)">')).toBe(
      '<img src="/a.png" alt="a" />',
    );
    expect(sanitiseRichText('<p onclick="alert(1)">Hi</p>')).toBe("<p>Hi</p>");
  });

  it("refuses a link that runs code rather than going somewhere", () => {
    expect(sanitiseRichText('<a href="javascript:alert(1)">x</a>')).toBe("<a>x</a>");
    expect(sanitiseRichText('<a href="data:text/html,<script>alert(1)</script>">x</a>')).toBe("<a>x</a>");
  });

  it("refuses a data: image, which can carry markup", () => {
    expect(sanitiseRichText('<img src="data:text/html,<script>alert(1)</script>">')).toBe("<img />");
  });

  it("drops an iframe, an object and a form outright", () => {
    expect(sanitiseRichText('<iframe src="https://evil.test"></iframe>')).toBe("");
    expect(sanitiseRichText('<object data="x.swf"></object>')).toBe("");
    expect(sanitiseRichText('<form action="/steal"><input name="password"></form>')).toBe("");
  });

  it("drops style and class, which repaint the page around the article", () => {
    expect(sanitiseRichText('<p style="position:fixed;inset:0" class="x">Hi</p>')).toBe("<p>Hi</p>");
    expect(sanitiseRichText("<style>body{display:none}</style>")).toBe("");
  });

  it("keeps the words when it drops the tag", () => {
    // An operator who wrapped a paragraph in a <div> should not find the
    // paragraph gone.
    expect(sanitiseRichText("<div>Kept</div>")).toBe("Kept");
  });

  it("leaves an ordinary article exactly as written", () => {
    const article =
      "<h2>Heading</h2>" +
      "<p><strong>Bold</strong> and <em>italic</em>.</p>" +
      "<ul><li>One</li><li>Two</li></ul>" +
      "<blockquote>Quoted</blockquote>" +
      '<table><tbody><tr><td>A</td><td>B</td></tr></tbody></table>';
    expect(sanitiseRichText(article)).toBe(article);
  });

  it("keeps a relative image, which is what the panel's own uploads are", () => {
    expect(sanitiseRichText('<img src="/uploads/a.png" alt="a" />')).toBe('<img src="/uploads/a.png" alt="a" />');
  });

  it("sends an external link out safely and leaves an internal one alone", () => {
    expect(sanitiseRichText('<a href="https://example.test">x</a>')).toBe(
      '<a href="https://example.test" target="_blank" rel="noopener noreferrer nofollow">x</a>',
    );
    expect(sanitiseRichText('<a href="/p/terms">x</a>')).toBe('<a href="/p/terms">x</a>');
  });

  it("drops the empty paragraph left behind when a list is lifted out", () => {
    // The editor wraps a new block in <p>, so a list arrives as
    // <p><ul>…</ul></p>; un-nesting it leaves a blank gap in the article.
    expect(sanitiseRichText("<p><ul><li>One</li></ul></p>")).toBe("<ul><li>One</li></ul>");
    expect(sanitiseRichText("<p>Kept</p><p></p><p>  </p>")).toBe("<p>Kept</p>");
  });

  it("keeps an element that is empty on purpose", () => {
    expect(sanitiseRichText('<p><img src="/a.png" alt="" /></p>')).toBe('<p><img src="/a.png" alt="" /></p>');
    expect(sanitiseRichText("<hr />")).toBe("<hr />");
  });

  it("is empty for empty input rather than throwing", () => {
    expect(sanitiseRichText("")).toBe("");
    expect(sanitiseRichText("   ")).toBe("");
  });
});
