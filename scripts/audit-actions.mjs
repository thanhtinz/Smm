/**
 * Every exported function in a "use server" file is a public endpoint.
 *
 * That is easy to forget when the file is called `admin/inbox.ts` and sits
 * next to fifteen functions that all start with `requireAdmin()`: a helper
 * added at the bottom to build a URL looks like a helper, and is in fact an
 * endpoint anybody on the internet can call. One did, and it handed back the
 * panel's webhook token.
 *
 * So the rule is checked rather than remembered: an exported action either
 * calls one of the guards, or is named here as deliberately public.
 *
 * Run with `npm run actions:check`.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "src/app/actions";

/** Anything that establishes who is calling. */
const GUARDS = /\b(requireAdmin|requireRootAdmin|requireStaff|requireUser|getCurrentUser|requirePermission)\b/;

/**
 * Actions that are meant to be callable by a stranger, with the reason.
 * Signing in cannot require being signed in; a guest picks a language before
 * they have an account.
 */
const PUBLIC = {
  "auth.ts": ["loginAction", "registerAction", "logoutAction", "resendVerificationAction"],
  "password-reset.ts": ["requestPasswordResetAction", "completePasswordResetAction"],
  "preferences.ts": ["setLocale", "setCurrency", "setTheme", "setTimezone", "setColorMode"],
  // The challenge is answered by someone who has passed the password but has
  // no session yet, so there is nothing to require.
  "two-factor.ts": ["submitCodeAction", "cancelPendingLoginAction"],
};

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : [];
  });
}

/**
 * Everything an exported function owns: from its signature to the next
 * top-level export, or the end of the file.
 *
 * Counting braces from the first `{` looks more precise and is wrong — a
 * return type written inline, `Promise<{ steps: ... }>`, opens a brace before
 * the body does, and the count then ends at the type rather than the
 * function. This span can over-reach into a private helper sitting between
 * two exports, which is worth a false pass on a check whose false failures
 * would teach people to ignore it.
 */
function bodyAt(source, from) {
  const next = source.slice(from + 1).search(/\nexport\s/);
  return next === -1 ? source.slice(from) : source.slice(from, from + 1 + next);
}

const problems = [];
let checked = 0;

for (const path of files(ROOT)) {
  const source = readFileSync(path, "utf8");
  if (!/^\s*["']use server["']/m.test(source)) continue;

  const key = path.slice(ROOT.length + 1);
  const allowed = new Set(PUBLIC[key] ?? []);

  for (const match of source.matchAll(/export\s+async\s+function\s+(\w+)\s*\(/g)) {
    checked++;
    const name = match[1];
    if (allowed.has(name)) continue;
    if (GUARDS.test(bodyAt(source, match.index))) continue;
    problems.push(`${path}  ${name}`);
  }
}

console.log(`\n${checked} server actions checked.`);
if (problems.length === 0) {
  console.log("Every one either establishes its caller or is listed as public.\n");
  process.exit(0);
}

console.log(`\n${problems.length} with no caller check and not listed as public:\n`);
for (const p of problems) console.log(`  ${p}`);
console.log("\nAdd a guard, or list it in PUBLIC in scripts/audit-actions.mjs with a reason.\n");
process.exit(1);
