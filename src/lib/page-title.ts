import type { Metadata } from "next";
import { readerMessages } from "./context";

/**
 * A page's own title, in the reader's language.
 *
 * The root layout already builds the title template from the operator's site
 * name and reads it per request, but every page under it declared a static
 * `metadata` with an English string — so a Vietnamese customer's tab, their
 * bookmark and their browser history all said "New order". The title is the
 * one piece of a page that leaves the page, which is exactly why it should not
 * be the one piece that never got translated.
 *
 * A function rather than a constant because the language is a property of the
 * request, and the panel picks it from the reader's preference, not from the
 * build.
 */
export function pageTitle(key: string) {
  return async function generateMetadata(): Promise<Metadata> {
    const t = await readerMessages();
    return { title: t(key) };
  };
}
