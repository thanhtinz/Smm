import { describe, expect, it, vi } from "vitest";

// Only the base currency's precision is read, and that is a settings lookup.
vi.mock("@/lib/currency", () => ({
  getBaseCurrency: async () => ({ code: "USD", decimals: 2 }),
}));

const {
  UNCATEGORISED,
  catalogueCategories,
  matchesQuery,
  normaliseCatalogue,
  normaliseRow,
  sellPrice,
  servicesInCategory,
} = await import("./provider-catalogue");

/**
 * What is being watched here is a provider's data, not this panel's.
 *
 * Every field in it arrives as a string, from a party that never agreed to
 * this panel's rules and changes its list without telling anyone. The costly
 * failures are silent: a min of zero that lets an order be placed the
 * provider will reject, a max under the min, a name long enough to be cut off
 * mid-import, a duplicated id that makes the ticked list and the imported
 * list disagree.
 */

const row = (over: Record<string, unknown> = {}) => ({
  service: "101",
  name: "Instagram Followers",
  category: "Instagram",
  rate: "1.35",
  min: "100",
  max: "10000",
  ...over,
});

describe("normaliseRow", () => {
  it("reads the standard's strings as numbers", () => {
    const entry = normaliseRow(row())!;
    expect(entry).toMatchObject({ providerServiceId: "101", rate: 1.35, min: 100, max: 10_000 });
  });

  it("refuses a row with no id, because nothing can be ordered against it", () => {
    expect(normaliseRow(row({ service: "" }))).toBeNull();
    expect(normaliseRow(row({ service: "   " }))).toBeNull();
    expect(normaliseRow({})).toBeNull();
  });

  it("never lets the minimum fall below one", () => {
    // A zero minimum is an order this panel accepts and the provider rejects.
    expect(normaliseRow(row({ min: "0" }))!.min).toBe(1);
    expect(normaliseRow(row({ min: "-50" }))!.min).toBe(1);
    expect(normaliseRow(row({ min: "nonsense" }))!.min).toBe(1);
  });

  it("takes the minimum as the ceiling when the provider reports max below it", () => {
    const entry = normaliseRow(row({ min: "500", max: "100" }))!;
    expect(entry.min).toBe(500);
    expect(entry.max).toBe(500);
  });

  it("keeps quantities whole", () => {
    const entry = normaliseRow(row({ min: "10.9", max: "999.9" }))!;
    expect(entry.min).toBe(10);
    expect(entry.max).toBe(999);
  });

  it("treats a missing or negative rate as free rather than as a credit", () => {
    expect(normaliseRow(row({ rate: undefined }))!.rate).toBe(0);
    expect(normaliseRow(row({ rate: "-4" }))!.rate).toBe(0);
  });

  it("cuts a name and a category to what the columns hold", () => {
    const entry = normaliseRow(row({ name: "x".repeat(400), category: "y".repeat(400) }))!;
    expect(entry.name).toHaveLength(250);
    expect(entry.category).toHaveLength(120);
  });

  it("falls back to the provider's id when they send no name", () => {
    expect(normaliseRow(row({ name: "" }))!.name).toBe("101");
    expect(normaliseRow(row({ name: "   " }))!.name).toBe("101");
  });

  it("files a service with no category of its own rather than losing it", () => {
    expect(normaliseRow(row({ category: "" }))!.category).toBe(UNCATEGORISED);
    expect(normaliseRow(row({ category: undefined }))!.category).toBe(UNCATEGORISED);
  });

  it("reads the three flags as booleans whatever they arrive as", () => {
    const entry = normaliseRow(row({ refill: true, cancel: undefined, dripfeed: "" }))!;
    expect(entry).toMatchObject({ refill: true, cancel: false, dripfeed: false });
  });
});

describe("normaliseCatalogue", () => {
  it("drops what is not a row at all instead of throwing", () => {
    expect(normaliseCatalogue([null, undefined, "text", 7, row()])).toHaveLength(1);
  });

  // The failure this guards: the operator ticks one line, the import walks two
  // rows with that id, and the counts they are shown do not match what landed.
  it("keeps the first of a repeated id and no more", () => {
    const entries = normaliseCatalogue([row({ name: "First" }), row({ name: "Second" })]);
    expect(entries).toHaveLength(1);
    expect(entries[0].name).toBe("First");
  });

  it("is empty for an empty list rather than throwing", () => {
    expect(normaliseCatalogue([])).toEqual([]);
  });
});

describe("catalogueCategories", () => {
  const entries = normaliseCatalogue([
    row({ service: "1", category: "TikTok" }),
    row({ service: "2", category: "Instagram" }),
    row({ service: "3", category: "Instagram" }),
    row({ service: "4", category: "" }),
  ]);

  it("counts what is in each one", () => {
    expect(catalogueCategories(entries)).toEqual([
      { name: "Instagram", count: 2 },
      { name: "TikTok", count: 1 },
      { name: UNCATEGORISED, count: 1 },
    ]);
  });

  it("adds up to the whole catalogue, so nothing is unreachable", () => {
    const total = catalogueCategories(entries).reduce((sum, c) => sum + c.count, 0);
    expect(total).toBe(entries.length);
  });

  it("is empty for an empty catalogue", () => {
    expect(catalogueCategories([])).toEqual([]);
  });
});

describe("matchesQuery", () => {
  const entry = normaliseRow(row({ service: "4821", name: "Instagram Followers | Real" }))!;

  it("matches part of the name, whatever the case", () => {
    expect(matchesQuery(entry, "follow")).toBe(true);
    expect(matchesQuery(entry, "FOLLOWERS")).toBe(true);
  });

  // An operator who knows which service they want has the provider's id in
  // front of them, not the name the provider wrote.
  it("matches the provider's own id", () => {
    expect(matchesQuery(entry, "4821")).toBe(true);
  });

  it("matches everything when nothing has been typed", () => {
    expect(matchesQuery(entry, "")).toBe(true);
    expect(matchesQuery(entry, "   ")).toBe(true);
  });

  it("says no rather than matching loosely", () => {
    expect(matchesQuery(entry, "youtube")).toBe(false);
  });
});

describe("servicesInCategory", () => {
  const entries = normaliseCatalogue([
    row({ service: "1", category: "Instagram", name: "Followers" }),
    row({ service: "2", category: "Instagram", name: "Likes" }),
    row({ service: "3", category: "TikTok", name: "Followers" }),
  ]);

  it("shows one category and never another's rows", () => {
    expect(servicesInCategory(entries, "Instagram").map((e) => e.providerServiceId)).toEqual(["1", "2"]);
  });

  // Select-all is computed from this list, so a search that leaked a row from
  // another category would import into the wrong place on one click.
  it("narrows within the category and stays inside it", () => {
    expect(servicesInCategory(entries, "Instagram", "followers").map((e) => e.providerServiceId)).toEqual(["1"]);
  });

  it("is empty for a category the provider does not have", () => {
    expect(servicesInCategory(entries, "YouTube")).toEqual([]);
  });
});

describe("sellPrice", () => {
  it("adds the markup", () => {
    expect(sellPrice(1.35, 60)).toBe(2.16);
    expect(sellPrice(10, 0)).toBe(10);
  });

  // Per-thousand prices are kept to four places: rounding them to the base
  // currency's two would flatten a whole catalogue onto the same few prices.
  it("keeps four places, not the currency's two", () => {
    expect(sellPrice(0.0001, 20)).toBe(0.0001);
    expect(sellPrice(0.12345, 0)).toBe(0.1235);
  });

  it("can price below cost when the operator has set a negative markup", () => {
    expect(sellPrice(10, -10)).toBe(9);
  });
});
