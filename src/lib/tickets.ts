/**
 * Support desk vocabulary.
 *
 * Statuses were spelled out in three places and priorities are new, so both
 * live here — the admin list, the customer's list and the actions all read
 * the same arrays.
 */

export const TICKET_STATUSES = ["open", "answered", "pending", "closed"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Anything a customer is still waiting on. Mutable because Prisma's `in`
 *  filter will not take a readonly array. */
export const OPEN_TICKET_STATUSES: string[] = ["open", "answered", "pending"];

/**
 * Priority is stored as a number so one `orderBy` puts the queue in the right
 * order; a string would have needed the whole table in memory to sort. The
 * names are the interface, the numbers are only how SQLite sees it.
 *
 * Support sets this, not the customer. Asked to rate their own urgency
 * everybody picks the top of the scale, and a column where every row says
 * "urgent" tells the person working the queue nothing at all.
 */
export const TICKET_PRIORITIES = [
  { key: "low", value: 0 },
  { key: "normal", value: 1 },
  { key: "high", value: 2 },
  { key: "urgent", value: 3 },
] as const;

export type TicketPriority = (typeof TICKET_PRIORITIES)[number]["key"];

export const DEFAULT_PRIORITY = 1;

export function priorityKey(value: number): TicketPriority {
  return TICKET_PRIORITIES.find((p) => p.value === value)?.key ?? "normal";
}

/** Null for a name that is not one of ours, so a bad form value is refused. */
export function priorityValue(key: string): number | null {
  return TICKET_PRIORITIES.find((p) => p.key === key)?.value ?? null;
}

/** Which badge a priority wears. Normal gets none — it is the default state. */
export function priorityTone(value: number): "danger" | "warning" | "muted" | null {
  if (value >= 3) return "danger";
  if (value === 2) return "warning";
  if (value <= 0) return "muted";
  return null;
}
