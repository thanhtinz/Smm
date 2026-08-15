/**
 * Gives every existing category the address it is about to be reachable at.
 *
 * Run once, between the migration that adds Category.slug and the one that
 * makes it unique per platform — the unique index cannot go on first, because
 * every existing row would collide on the empty default.
 *
 * Re-runnable: a category that already has a slug is left alone, so an
 * operator's own wording is never overwritten by a generated one.
 */
import { PrismaClient } from "@prisma/client";

// The same rule the admin form uses, so a slug generated here and a slug
// typed there cannot disagree about the same name.
function slugify(input) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const db = new PrismaClient();
const categories = await db.category.findMany({
  orderBy: [{ position: "asc" }, { name: "asc" }],
  select: { id: true, name: true, slug: true, platformId: true, panelId: true },
});

// Uniqueness is per panel and platform, so the taken set is keyed by both.
const taken = new Map();
const keyOf = (c) => `${c.panelId}::${c.platformId ?? ""}`;
for (const c of categories) {
  if (!c.slug) continue;
  if (!taken.has(keyOf(c))) taken.set(keyOf(c), new Set());
  taken.get(keyOf(c)).add(c.slug);
}

let filled = 0;
for (const category of categories) {
  if (category.slug) continue;

  const key = keyOf(category);
  if (!taken.has(key)) taken.set(key, new Set());
  const used = taken.get(key);

  // A category named only in a script this rule strips — or two categories
  // with the same name under one platform — still has to end up with an
  // address, so the id is the fallback and the counter the tie-break.
  const base = slugify(category.name) || `c-${category.id.slice(-6)}`;
  let slug = base;
  for (let n = 2; used.has(slug); n++) slug = `${base}-${n}`;
  used.add(slug);

  await db.category.update({ where: { id: category.id }, data: { slug } });
  console.log(`  ${slug}  <- ${category.name}`);
  filled++;
}

await db.$disconnect();
console.log(`\n${filled} filled, ${categories.length - filled} already had one.`);
