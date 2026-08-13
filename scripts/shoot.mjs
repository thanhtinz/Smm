/**
 * Screenshot helper. Usage:
 *   node scripts/shoot.mjs <name> <path> [--mode=dark|light] [--theme=slug]
 *                          [--full] [--width=1440] [--height=900] [--login=user]
 * Output lands in docs/screenshots/<name>.png
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
const outDir = resolve(process.cwd(), "docs/screenshots");
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
  await Promise.all([page.waitForURL(/dashboard|admin/, { timeout: 20000 }), page.click('button[type="submit"]')]);
}

await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
await page.waitForTimeout(Number(flag("wait", 700)));

const file = resolve(outDir, `${name}.png`);
await page.screenshot({ path: file, fullPage: has("full") });
console.log(file);

await browser.close();
