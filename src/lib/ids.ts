import { db } from "./db";

const START: Record<string, number> = {
  user: 1000,
  service: 1000,
  order: 100000,
  transaction: 100000,
  ticket: 1000,
  request: 1000,
};

/**
 * Allocates the next short public id for an entity. SQLite has no sequences
 * for non-primary-key columns, so the Counter table plays that role.
 */
export async function nextPublicId(entity: keyof typeof START | string): Promise<number> {
  const start = START[entity] ?? 1000;
  const existing = await db.counter.findUnique({ where: { name: entity } });
  if (!existing) {
    await db.counter.create({ data: { name: entity, value: start + 1 } });
    return start + 1;
  }
  const updated = await db.counter.update({
    where: { name: entity },
    data: { value: { increment: 1 } },
  });
  return updated.value;
}
