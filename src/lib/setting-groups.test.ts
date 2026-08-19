import { describe, expect, it } from "vitest";
import { settingDefinitions } from "./settings";
import {
  SETTING_BANDS,
  groupSummary,
  groupTitle,
  settingBands,
  settingCount,
  settingFields,
  settingGroups,
} from "./setting-groups";

/**
 * These four functions decide what an operator can find: the settings index,
 * each section page, the branch in the sidebar and the paths the smoke walk
 * discovers all read from here. The failure they guard against is not a crash
 * — it is a setting that quietly stops appearing anywhere, which nobody
 * notices until they go looking for it.
 *
 * So the registry is used as it really is, not mocked. It is the thing being
 * watched.
 */

const declared = new Set(Object.values(settingDefinitions).map((def) => (def as { group: string }).group));

/** A translator that has an entry for nothing, to exercise the fallbacks. */
const bare = (key: string) => key;

describe("settingGroups", () => {
  it("names every group the registry declares, and nothing else", () => {
    expect(new Set(settingGroups())).toEqual(declared);
  });

  it("names each one exactly once", () => {
    const groups = settingGroups();
    expect(groups.length).toBe(new Set(groups).size);
  });

  it("puts the arranged ones first, in the arranged order", () => {
    const arranged = SETTING_BANDS.flatMap((band) => band.groups).filter((g) => declared.has(g));
    expect(settingGroups().slice(0, arranged.length)).toEqual(arranged);
  });
});

describe("settingBands", () => {
  // The one that matters: a group that falls out of every band is a page of
  // settings with no way in.
  it("accounts for every group across the bands", () => {
    const inBands = settingBands().flatMap((band) => band.groups);
    expect(new Set(inBands)).toEqual(declared);
    expect(inBands.length).toBe(declared.size);
  });

  it("keeps a band's own order and drops a band with nothing in it", () => {
    for (const band of settingBands()) {
      expect(band.groups.length).toBeGreaterThan(0);
      const source = SETTING_BANDS.find((b) => b.key === band.key);
      if (source) expect(band.groups).toEqual(source.groups.filter((g) => declared.has(g)));
    }
  });

  // Adding a group to the registry and forgetting to place it in a band is the
  // easy mistake, and it does not break anything loudly: the section just
  // appears at the bottom under "other", where nobody looks for it.
  it("places the features section deliberately rather than leaving it to the leftovers", () => {
    const other = settingBands().find((b) => b.key === "other");
    expect(other?.groups ?? []).not.toContain("features");
    expect(SETTING_BANDS.flatMap((b) => b.groups)).toContain("features");
  });

  it("gathers anything the bands do not mention rather than losing it", () => {
    // Today every group is arranged, so the mechanism is asserted rather than
    // observed: whatever is missing from SETTING_BANDS is exactly what the
    // "other" band must carry.
    const arranged = new Set(SETTING_BANDS.flatMap((b) => b.groups));
    const orphans = [...declared].filter((g) => !arranged.has(g));
    const other = settingBands().find((b) => b.key === "other");

    if (orphans.length === 0) expect(other).toBeUndefined();
    else expect(other?.groups).toEqual(orphans);
  });
});

describe("settingCount", () => {
  it("adds up to every setting in the registry, so none sits outside a section", () => {
    const total = settingGroups().reduce((sum, group) => sum + settingCount(group), 0);
    expect(total).toBe(Object.keys(settingDefinitions).length);
  });

  it("counts nothing for a group that does not exist", () => {
    expect(settingCount("not-a-group")).toBe(0);
  });
});

describe("groupTitle and groupSummary", () => {
  // t() answers with the key when the dictionary has no entry. Printing
  // "settingGroup.wallet" at an operator is worse than printing "wallet".
  it("falls back to the group's own name rather than to a lookup key", () => {
    expect(groupTitle("wallet", bare)).toBe("wallet");
    expect(groupSummary("wallet", bare)).toBe("");
  });

  it("uses the dictionary when it has one", () => {
    const t = (key: string) => (key === "settingGroup.wallet" ? "Ví tiền" : key);
    expect(groupTitle("wallet", t)).toBe("Ví tiền");
  });
});

describe("settingFields", () => {
  it("returns that section's settings and no other section's", () => {
    for (const group of settingGroups()) {
      const keys = settingFields(group, bare, {}).map((f) => f.key);
      expect(keys.length).toBe(settingCount(group));
      for (const key of keys) {
        expect((settingDefinitions as Record<string, { group: string }>)[key].group).toBe(group);
      }
    }
  });

  it("carries the stored value through, including a falsy one", () => {
    const fields = settingFields("wallet", bare, { "wallet.minDeposit": 0 });
    // Zero is a real minimum, not a missing one.
    expect(fields.find((f) => f.key === "wallet.minDeposit")?.value).toBe(0);
  });

  it("leaves the label blank when the dictionary has no name for a setting", () => {
    // Blank is the signal for the form to derive a name from the key itself,
    // rather than showing "setting.wallet.minDeposit".
    const fields = settingFields("wallet", bare, {});
    expect(fields.every((f) => f.label === "")).toBe(true);
  });
});
