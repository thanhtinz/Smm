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

      "no-restricted-syntax": [
        "error",
        {
          // Called with no argument this follows whichever locale the process
          // defaults to — the server's for a page rendered there, the
          // browser's for one rendered here — so the same quantity printed
          // "5,000" beside a price of "5.000 ₫". It had spread to two dozen
          // callsites before anyone noticed, which is why it is a rule and
          // not a fixed list of files.
          selector:
            "CallExpression[callee.property.name='toLocaleString'][arguments.length=0]",
          message: "Use formatCount(value, locale) from @/lib/numbers — a bare toLocaleString() follows the server's locale, not the reader's.",
        },
        {
          // Same defect, one layer down: a formatter built without a locale.
          selector: "NewExpression[callee.object.name='Intl'][arguments.length=0]",
          message: "Pass the reader's locale — see localeTag() in @/lib/numbers.",
        },
        {
          // `Intl.NumberFormat(...)` is legal without `new` and returns the
          // same formatter, so the rule above walked straight past it.
          selector: "CallExpression[callee.object.name='Intl'][arguments.length=0]",
          message: "Pass the reader's locale — see localeTag() in @/lib/numbers.",
        },
        {
          // And `new Intl.NumberFormat(undefined, {...})` has an argument, so
          // it passed the length check while doing exactly what the check is
          // there to stop.
          selector: "NewExpression[callee.object.name='Intl'] > Identifier.arguments:first-child[name='undefined']",
          message: "Pass the reader's locale — see localeTag() in @/lib/numbers.",
        },
        {
          // The locale tag itself, written out by hand in a dozen places
          // before localeTag() existed. One list of language-to-tag mappings
          // is enough, and it is the one the messages above point at.
          selector: "ConditionalExpression[consequent.value='vi-VN']",
          message: "Use localeTag(locale) from @/lib/numbers instead of spelling out the vi-VN mapping.",
        },
      ],
    },
  },
  {
    // The one file allowed to name the formatters, since it is the one that
    // takes the locale as an argument.
    files: ["src/lib/numbers.ts"],
    rules: { "no-restricted-syntax": "off" },
  },
];
