/**
 * Which slice of a list a page shows.
 *
 * Small enough to write inline, and wrong inline at least once in every
 * project: a search that shortens the list leaves the reader on page four of
 * two and staring at nothing, and an off-by-one at the boundary silently hides
 * a row that no page ever shows.
 */
export type Page<T> = {
  /** The rows to render. */
  items: T[];
  /** Clamped into range, so it is safe to render as "page N". */
  page: number;
  pages: number;
};

export function paginate<T>(items: T[], page: number, perPage: number): Page<T> {
  const size = Math.max(1, Math.floor(perPage));
  const pages = Math.max(1, Math.ceil(items.length / size));
  // A page number from state, a URL or a stale click is not to be trusted.
  const current = Math.min(Math.max(0, Math.floor(page) || 0), pages - 1);
  return { items: items.slice(current * size, current * size + size), page: current, pages };
}
