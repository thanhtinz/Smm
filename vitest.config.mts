import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Unit tests for the parts of the panel that handle money.
 *
 * Deliberately narrow. The repo already checks the things a script can check —
 * translation keys, design tokens, action authorisation, tenant registration,
 * every page opening — and none of that needed a test runner. What had no
 * cover at all was the arithmetic: rounding, conversion, charges, refunds,
 * the tolerance a gateway is held to. Those are pure functions, so they get
 * pure tests, and every one of them below is a bug that actually shipped.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
