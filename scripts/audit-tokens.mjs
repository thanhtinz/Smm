/**
 * Every `var(--token)` in the app names a token that exists.
 *
 * CSS has no error for this. A misspelled custom property makes the whole
 * declaration invalid and the browser drops it in silence — which is fine for
 * a border and not fine for `background: linear-gradient(…var(--info))` under
 * `color: transparent`, where the result is a headline that renders as
 * nothing at all. That is exactly what happened: the theme's second colour is
 * `--accent`, `--info` was never a token, and the accent half of a hero
 * headline was invisible on a page that otherwise looked finished.
 *
 * So the names are checked against the ones globals.css actually defines.
 *
 * Run with `npm run tokens:check`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CSS = "src/app/globals.css";
const ROOT = "src";

/**
 * Tokens defined anywhere in the stylesheet, in any selector — a theme block
 * counts, and so does a media query.
 */
const css = readFileSync(CSS, "utf8");
const defined = new Set([...css.matchAll(/^\s*(--[a-z0-9-]+)\s*:/gim)].map((m) => m[1]));

/**
 * Plus the ones next/font declares. Those are real tokens that never appear
 * in a stylesheet — the loader writes them onto the html element at build
 * time — and flagging them would be the kind of false failure that teaches
 * people to stop reading this output.
 */
for (const match of readFileSync("src/app/layout.tsx", "utf8").matchAll(/variable:\s*"(--[a-z0-9-]+)"/g)) {
  defined.add(match[1]);
}

/**
 * And ones a component defines for itself before using, which is how a layout
 * with its own palette works.
 */
function locallyDefined(source) {
  return new Set([...source.matchAll(/"(--[a-z0-9-]+)"\s*:/g)].map((m) => m[1]));
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|css)$/.test(path) ? [path] : [];
  });
}

const problems = [];
let used = 0;

for (const path of files(ROOT)) {
  if (path === CSS) continue;
  const source = readFileSync(path, "utf8");
  const local = locallyDefined(source);

  for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
    used++;
    const token = match[1];
    if (defined.has(token) || local.has(token)) continue;
    const line = source.slice(0, match.index).split("\n").length;
    problems.push(`${path}:${line}  ${token}`);
  }
}

console.log(`\n${used} token references checked against ${defined.size} defined in ${CSS}.`);
if (problems.length === 0) {
  console.log("Every one names a token that exists.\n");
  process.exit(0);
}

console.log(`\n${problems.length} naming a token nothing defines:\n`);
for (const p of problems) console.log(`  ${p}`);
console.log("");
process.exit(1);
