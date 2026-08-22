import { describe, expect, it } from "vitest";
import { paginate } from "./paging";

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

describe("paginate", () => {
  it("cuts the list into whole pages", () => {
    expect(paginate(rows(24), 0, 8).items).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(paginate(rows(24), 1, 8).items).toEqual([8, 9, 10, 11, 12, 13, 14, 15]);
    expect(paginate(rows(24), 2, 8).items).toEqual([16, 17, 18, 19, 20, 21, 22, 23]);
  });

  // The failure that matters: a row no page shows.
  it("shows every row exactly once across all its pages", () => {
    for (const total of [0, 1, 7, 8, 9, 23, 24, 25, 100]) {
      const { pages } = paginate(rows(total), 0, 8);
      const seen = Array.from({ length: pages }, (_, p) => paginate(rows(total), p, 8).items).flat();
      expect(seen).toEqual(rows(total));
    }
  });

  it("has a last page that is short rather than padded", () => {
    expect(paginate(rows(25), 3, 8).items).toEqual([24]);
  });

  // A search that shortens the list leaves the reader past the end of it.
  it("clamps a page number that is past the end", () => {
    const page = paginate(rows(9), 7, 8);
    expect(page.page).toBe(1);
    expect(page.items).toEqual([8]);
  });

  it("clamps a page number that is before the start, or is not one", () => {
    for (const bad of [-1, -100, NaN, 0.4]) {
      expect(paginate(rows(9), bad, 8).page).toBe(0);
    }
  });

  it("is one empty page for an empty list, not zero pages", () => {
    const page = paginate(rows(0), 0, 8);
    expect(page).toEqual({ items: [], page: 0, pages: 1 });
  });

  it("never divides by a page size of zero", () => {
    expect(paginate(rows(3), 0, 0).items).toEqual([0]);
    expect(paginate(rows(3), 0, -5).items).toEqual([0]);
  });
});
