import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import svelte from "eslint-plugin-svelte";
import globals from "globals";
import tseslint from "typescript-eslint";

const { rules: reactHooksRules } = reactHooks.configs.flat.recommended;

export default tseslint.config(
  // test/wordgard/ holds unchanged copies of Wordgard's tests.
  { ignores: ["**/dist/", "**/.svelte-kit/", "demo-dist/", "test/wordgard/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooksRules,
      "no-console": ["error", { allow: ["error"] }],
      "react-hooks/exhaustive-deps": [
        "warn",
        {
          additionalHooks: "(useEditorEffect|useLayoutGroupEffect|useClientLayoutEffect$)",
        },
      ],
      "sort-imports": ["error", { allowSeparatedGroups: true, ignoreDeclarationSort: true }],
      // The TypeScript compiler checks this.
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["*.{js,ts}", "scripts/**/*.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["scripts/**/*.js"],
    rules: { "no-console": "off" },
  },
  // Vue's composables run once, in `setup`, and Svelte's in a component's script: React's rules
  // don't apply.
  {
    files: [
      "packages/vue/**/*.ts",
      "demo/vue/**/*.ts",
      "packages/svelte/**/*.{ts,svelte}",
      "demo/svelte/**/*.{ts,svelte}",
      "bench/svelte/**/*.svelte",
    ],
    rules: Object.fromEntries(Object.keys(reactHooksRules).map((rule) => [rule, "off"])),
  },
  svelte.configs.recommended,
  {
    files: ["**/*.svelte", "**/*.svelte.ts"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  prettier,
  svelte.configs.prettier
);
