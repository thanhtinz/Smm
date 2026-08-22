import { describe, expect, it } from "vitest";
import { missingCurrencies, offerableCurrencies, usableCurrencies } from "./currencies";

/**
 * The bug this exists for: PayNow was seeded with SGD, no panel has SGD unless
 * somebody created it, and the method went on offering a currency nothing in
 * the panel could price. Nothing threw — a customer just picked a currency
 * that did not exist.
 *
 * So every case here is really asking the same question: can a code the panel
 * has not created get through, by any route?
 */

const PANEL = ["USD", "EUR", "VND", "THB"];

describe("usableCurrencies", () => {
  it("offers what the operator ticked", () => {
    expect(usableCurrencies({ rail: undefined, chosen: ["USD"], panel: PANEL })).toEqual(["USD"]);
  });

  // The one that was wrong.
  it("never offers a currency the panel has not created", () => {
    expect(usableCurrencies({ rail: ["SGD"], chosen: ["SGD"], panel: PANEL })).toEqual([]);
    expect(usableCurrencies({ rail: undefined, chosen: ["SGD"], panel: PANEL })).toEqual(PANEL);
  });

  // A rail that only moves dong must not become one that takes dollars just
  // because the operator unticked everything.
  it("keeps the rail's own limit when nothing is ticked", () => {
    expect(usableCurrencies({ rail: ["VND"], chosen: [], panel: PANEL })).toEqual(["VND"]);
  });

  it("expands an empty choice to everything the panel has, when the rail has no limit", () => {
    expect(usableCurrencies({ rail: undefined, chosen: [], panel: PANEL })).toEqual(PANEL);
  });

  it("drops a ticked currency the rail cannot move", () => {
    expect(usableCurrencies({ rail: ["VND"], chosen: ["VND", "USD"], panel: PANEL })).toEqual(["VND"]);
  });

  // A rail whose every currency is missing has nothing to offer, and saying so
  // is better than falling back to something it cannot take.
  it("is empty when the rail and the panel have nothing in common", () => {
    expect(usableCurrencies({ rail: ["SGD", "MYR"], chosen: [], panel: PANEL })).toEqual([]);
  });

  it("reads codes whatever case or spacing they were stored in", () => {
    expect(usableCurrencies({ rail: ["vnd"], chosen: [" vnd "], panel: ["VND"] })).toEqual(["VND"]);
  });

  it("is empty for a panel with no currencies at all rather than throwing", () => {
    expect(usableCurrencies({ rail: ["USD"], chosen: ["USD"], panel: [] })).toEqual([]);
  });
});

describe("offerableCurrencies", () => {
  it("offers the whole panel when the rail has no limit", () => {
    expect(offerableCurrencies(undefined, PANEL)).toEqual(PANEL);
  });

  it("offers the overlap, in the panel's own order", () => {
    expect(offerableCurrencies(["THB", "USD"], PANEL)).toEqual(["USD", "THB"]);
  });

  it("offers nothing when the panel has none of the rail's currencies", () => {
    expect(offerableCurrencies(["SGD"], PANEL)).toEqual([]);
  });
});

describe("missingCurrencies", () => {
  // So "nothing to tick" becomes "create SGD first" rather than an empty box.
  it("names what the operator would have to create", () => {
    expect(missingCurrencies(["SGD", "USD"], PANEL)).toEqual(["SGD"]);
  });

  it("names nothing for a rail with no limit, or one fully covered", () => {
    expect(missingCurrencies(undefined, PANEL)).toEqual([]);
    expect(missingCurrencies(["USD", "EUR"], PANEL)).toEqual([]);
  });
});
