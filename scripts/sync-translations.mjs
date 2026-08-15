/**
 * Reset named translation keys to the bundled default.
 *
 *   npm run translations:sync -- order.dripfeed order.mass
 *   npm run translations:sync -- --dry order.dripfeed
 *
 * The bundled dictionaries in src/lib/dictionaries.ts are only a seed: once a
 * language has been seeded, every string lives in the Translation table and
 * that row wins. So editing the file changes nothing on an installed panel,
 * and the operator has to go key by key in Admin -> Translations.
 *
 * This is the way back for the case where the default itself was wrong. It
 * only ever touches keys named on the command line — never a sweep — because
 * a blanket resync would silently throw away every wording an operator has
 * chosen.
 */
import { PrismaClient } from "@prisma/client";

// Run through tsx (npm run translations:sync) so the .ts dictionary resolves.
const { bundledDictionaries } = await import("../src/lib/dictionaries.ts");

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const keys = args.filter((a) => !a.startsWith("--"));

if (keys.length === 0) {
  console.error("Name at least one key. Nothing is resynced by default.");
  process.exit(1);
}

const db = new PrismaClient();
const languages = await db.language.findMany({ select: { id: true, code: true } });
let changed = 0;

for (const lang of languages) {
  const bundled = bundledDictionaries[lang.code];
  if (!bundled) continue;

  for (const key of keys) {
    const want = bundled[key];
    if (want === undefined) {
      console.log(`  skip  ${lang.code} ${key} — not in the bundled dictionary`);
      continue;
    }
    const row = await db.translation.findUnique({
      where: { languageId_namespace_key: { languageId: lang.id, namespace: "common", key } },
    });
    if (!row) {
      console.log(`  skip  ${lang.code} ${key} — no row; it will seed from the file`);
      continue;
    }
    if (row.value === want) {
      console.log(`  same  ${lang.code} ${key}`);
      continue;
    }
    console.log(`${dry ? "  would" : "    ok"}  ${lang.code} ${key}: ${JSON.stringify(row.value)} -> ${JSON.stringify(want)}`);
    if (!dry) await db.translation.update({ where: { id: row.id }, data: { value: want } });
    changed++;
  }
}

await db.$disconnect();
console.log(`\n${changed} ${dry ? "would change" : "changed"}.`);
