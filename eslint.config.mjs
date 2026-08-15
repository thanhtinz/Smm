import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

/**
 * The rules that catch what a type checker cannot.
 *
 * tsc has passed on every commit in this project and still let through a
 * variable named `window` that silently resolved to the DOM global, and a
 * server-only import pulled into a client bundle. Both are lint's job.
 */
export default [
  { ignores: [".next/**", "node_modules/**", "prisma/migrations/**", "docs/**"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // Deliberate: an unused argument is often there to name a position in a
      // signature the framework fixes, and prefixing it with _ says so.
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];
