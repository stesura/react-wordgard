import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const { rules: reactHooksRules } = reactHooks.configs.flat.recommended;

export default tseslint.config(
  // test/wordgard/ holds unchanged copies of Wordgard's tests.
  { ignores: ["dist/", "test/wordgard/"] },
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
  prettier
);
