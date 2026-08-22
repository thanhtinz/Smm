/**
 * Screenshot helper. Usage:
 *   node scripts/shoot.mjs <name> <path> [--mode=dark|light] [--theme=slug]
 *                          [--full] [--width=1440] [--height=900] [--login=user]
 *                          [--click=<selector>]
 * Output lands in var/screenshots/<name>.png, which the repository ignores:
 * a screenshot is a picture of a run, not a source file.
 */
import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { resolve } from "path";

const args = process.argv.slice(2);
const name = args[0];
const path = args[1] ?? "/";
const flag = (k, d) => {
  const hit = args.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.split("=").slice(1).join("=") : d;
};
const has = (k) => args.includes(`--${k}`);

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const outDir = resolve(process.cwd(), "var/screenshots");
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ args: ["--no-sandbox"] });
const context = await browser.newContext({
  viewport: { width: Number(flag("width", 1440)), height: Number(flag("height", 900)) },
  deviceScaleFactor: 2,
});

const cookies = [];
const push = (n, v) => cookies.push({ name: n, value: v, url: BASE });
push("nova_mode", flag("mode", "dark"));
push("nova_theme", flag("theme", "aurora"));
if (flag("locale", null)) push("nova_locale", flag("locale"));
if (flag("currency", null)) push("nova_currency", flag("currency"));
await context.addCookies(cookies);

const page = await context.newPage();

const login = flag("login", null);
if (login) {
  const [username, password] = login.split(":");
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="identifier"]', username);
  await page.fill('input[name="password"]', password);
  await Promise.all([
    page.waitForURL(/dashboard|admin|two-factor/, { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);

  // An account with two-factor on lands on the challenge instead; the code is
  // derived here so a screenshot run needs no phone.
  if (page.url().includes("/two-factor")) {
    const secret = flag("totp", null);
    if (!secret) throw new Error("This account has two-factor on — pass --totp=<secret>");
    const { currentCode } = await import("../src/lib/totp.ts");
    await page.fill('input[name="code"]', currentCode(secret));
    await Promise.all([page.waitForURL(/dashboard|admin/, { timeout: 20000 }), page.click('button[type="submit"]')]);
  }
}

await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });

// Drawers, dialogs and anything else that only exists after a click.
const click = flag("click", null);
if (click) {
  await page.click(click);
  await page.waitForTimeout(600);
}

await page.waitForTimeout(Number(flag("wait", 700)));

const file = resolve(outDir, `${name}.png`);
await page.screenshot({ path: file, fullPage: has("full") });
console.log(file);

await browser.close();
