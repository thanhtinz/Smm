"use client";

import { useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

export type RichEditorLabels = {
  bold: string;
  italic: string;
  underline: string;
  strike: string;
  h2: string;
  h3: string;
  bullets: string;
  numbers: string;
  quote: string;
  link: string;
  unlink: string;
  clear: string;
  linkPrompt: string;
};

/**
 * Writing an article without writing HTML.
 *
 * The field this replaces was a textarea holding markup, which asked an
 * operator to know what a `<blockquote>` is in order to quote somebody. This
 * is the same content through a toolbar.
 *
 * It is not what makes the content safe — a server action takes whatever is
 * POSTed to it, with or without a browser, so `sanitiseRichText` filters on
 * the way into the database and this only has to be pleasant. That division
 * is why the toolbar can stay this small.
 *
 * Built on contentEditable rather than on an editor library: the whole of what
 * is needed here is eleven buttons, and Tiptap or Quill would bring dozens of
 * packages to a repository that has so far drawn its own components.
 * `execCommand` is deprecated and still the only thing every browser
 * implements for this; whatever markup it produces is normalised by the
 * filter on save.
 */
export default function RichEditor({
  name,
  defaultValue = "",
  labels,
}: {
  name: string;
  defaultValue?: string;
  labels: RichEditorLabels;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue);

  // Written once, by hand: React must not own this subtree, or every keystroke
  // would rewrite the node the caret is sitting in and send it to the start.
  useEffect(() => {
    if (box.current && box.current.innerHTML !== defaultValue)
      box.current.innerHTML = defaultValue;
    // Only when the editor is handed a different post to edit.
  }, [defaultValue]);

  // Enter makes a paragraph, not a <div>. Chromium's default is a div, which
  // the filter drops on save — so an article written here arrived as one run
  // of text with every paragraph break gone.
  useEffect(() => {
    document.execCommand("defaultParagraphSeparator", false, "p");
  }, []);

  const sync = () => setHtml(box.current?.innerHTML ?? "");

  const run = (command: string, value?: string) => {
    box.current?.focus();
    document.execCommand(command, false, value);
    sync();
  };

  /**
   * Headings toggle. `formatBlock` only ever applies, so pressing Heading on a
   * line that is already a heading left it a heading — there was no way back
   * to an ordinary paragraph except deleting the line and retyping it.
   *
   * Read off the element the caret is in rather than from
   * `queryCommandValue`, which answers with nothing on a line that is still
   * empty — exactly the case that matters, since pressing Enter at the end of
   * a heading opens an empty heading and that is where a writer presses the
   * button to get back to prose.
   */
  const currentBlock = (): string => {
    const node = window.getSelection()?.anchorNode;
    let el = node instanceof Element ? node : (node?.parentElement ?? null);
    while (el && el !== box.current) {
      if (/^(H2|H3|BLOCKQUOTE|P|DIV|LI)$/.test(el.tagName)) return el.tagName.toLowerCase();
      el = el.parentElement;
    }
    return "";
  };

  const block = (tag: "h2" | "h3" | "blockquote") => {
    run("formatBlock", currentBlock() === tag ? "<p>" : `<${tag}>`);
  };

  const addLink = () => {
    const url = window.prompt(labels.linkPrompt, "https://");
    if (!url) return;
    // Anything that is not a web address is dropped by the filter on save
    // anyway; refusing here saves the operator finding out later.
    if (!/^(https?:\/\/|mailto:|\/)/i.test(url)) return;
    run("createLink", url);
  };

  const tools: {
    key: keyof RichEditorLabels;
    icon: IconName;
    onClick: () => void;
  }[] = [
    { key: "bold", icon: "bold", onClick: () => run("bold") },
    { key: "italic", icon: "italic", onClick: () => run("italic") },
    { key: "underline", icon: "underline", onClick: () => run("underline") },
    {
      key: "strike",
      icon: "strikethrough",
      onClick: () => run("strikeThrough"),
    },
    { key: "h2", icon: "heading", onClick: () => block("h2") },
    { key: "h3", icon: "heading", onClick: () => block("h3") },
    { key: "bullets", icon: "list", onClick: () => run("insertUnorderedList") },
    {
      key: "numbers",
      icon: "listOrdered",
      onClick: () => run("insertOrderedList"),
    },
    { key: "quote", icon: "quote", onClick: () => block("blockquote") },
    { key: "link", icon: "link", onClick: addLink },
    { key: "unlink", icon: "unlink", onClick: () => run("unlink") },
    { key: "clear", icon: "close", onClick: () => run("removeFormat") },
  ];

  return (
    <div>
      <div className="surface-2 flex flex-wrap gap-1 rounded-t-xl border border-b-0 border-[var(--border)] p-1.5">
        {tools.map((tool, i) => (
          <button
            // h2 and h3 share an icon, so the key carries the level.
            key={`${tool.key}-${i}`}
            type="button"
            title={labels[tool.key]}
            aria-label={labels[tool.key]}
            // The editor keeps the caret: a button that steals focus would
            // collapse the selection it is about to act on.
            onMouseDown={(e) => e.preventDefault()}
            onClick={tool.onClick}
            className="ring-focus muted rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--surface)] hover:text-[var(--text)]"
          >
            <Icon name={tool.icon} size={tool.key === "h3" ? 13 : 16} />
          </button>
        ))}
      </div>

      <div
        ref={box}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onBlur={sync}
        role="textbox"
        aria-multiline="true"
        className="prose-page field min-h-56 rounded-t-none"
      />

      <input type="hidden" name={name} value={html} />
    </div>
  );
}
