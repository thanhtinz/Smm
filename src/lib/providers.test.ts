import { describe, expect, it } from "vitest";
import { providerLabel } from "./providers";

describe("providerLabel", () => {
  /**
   * An operator who renames a supplier does it because they do not want the
   * real name on a screen that gets shared — a screenshot in a group chat, a
   * shared screen on a support call. It shipped applied on the dispatch path
   * and not on the status-sync path, so one order timeline carried the same
   * supplier under two names and the real one reached /admin.
   */
  it("prefers the alias when there is one", () => {
    expect(providerLabel({ name: "SmmKings", alias: "Nguồn A" })).toBe("Nguồn A");
  });

  it("falls back to the real name, which is where every provider starts", () => {
    expect(providerLabel({ name: "SmmKings", alias: "" })).toBe("SmmKings");
  });

  it("treats an alias of only spaces as no alias", () => {
    // Otherwise clearing the field by pressing space renames the supplier to
    // something invisible on every screen.
    expect(providerLabel({ name: "SmmKings", alias: "   " })).toBe("SmmKings");
  });

  it("trims an alias that was pasted with spaces around it", () => {
    expect(providerLabel({ name: "SmmKings", alias: "  Nguồn A  " })).toBe("Nguồn A");
  });
});
