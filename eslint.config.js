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
      // viewdesc.ts, copied from ProseMirror, uses ternaries as statements.
      "@typescript-eslint/no-unused-expressions": ["error", { allowTernary: true }],
    },
  },
  {
    // The React Compiler's Rules of React (refs, immutability, purity, ...)
    // gave 35 findings on 2026-10-30, all in the ProseMirror view code, mostly
    // refs written during render. Off there until it's replaced, and in
    // src/helpers/refs.ts (copied from react-prosemirror, a spread dependency list).
    files: ["src/prosemirror/**", "src/helpers/refs.ts"],
    rules: Object.fromEntries(
      Object.keys(reactHooksRules)
        .filter((rule) => !/rules-of-hooks|exhaustive-deps/.test(rule))
        .map((rule) => [rule, "off"])
    ),
  },
  {
    // src/prosemirror/hooks/useEffectEvent.ts stands in for React's
    // useEffectEvent (it predates it and supports React 17), but these hooks
    // list its functions in dependency arrays and call them from a ref
    // callback, which React's version forbids. react-hooks applies those
    // rules to anything named useEffectEvent. The files get rewritten for
    // Wordgard.
    files: [
      "src/prosemirror/hooks/useEditor.ts",
      "src/prosemirror/hooks/useMarkViewDescription.ts",
      "src/prosemirror/hooks/useNodeViewDescription.ts",
    ],
    rules: {
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
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
