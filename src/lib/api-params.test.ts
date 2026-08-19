import { describe, expect, it } from "vitest";
import { parseApiBody } from "./api-params";

describe("parseApiBody", () => {
  it("parses urlencoded bodies", () => {
    expect(parseApiBody("key=abc&action=balance", "")).toEqual({ key: "abc", action: "balance" });
  });

  it("parses JSON without a Content-Type", () => {
    expect(parseApiBody('{"key":"abc","action":"services"}', "")).toEqual({ key: "abc", action: "services" });
  });

  it("parses JSON when Content-Type is application/json", () => {
    expect(parseApiBody('{"action":"add","service":"1"}', "application/json")).toEqual({
      action: "add",
      service: "1",
    });
  });

  it("returns an empty object for blank bodies", () => {
    expect(parseApiBody("   ", "")).toEqual({});
  });
});
