import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/"] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
    },
    plugins: { "react-hooks": reactHooks },
    // Only the two classic react-hooks rules for now. The plugin's
    // `configs.flat.recommended` adds the React Compiler's Rules of React
    // (refs, immutability, purity, ...); on 2026-10-30 that gave 35 findings,
    // all in the ProseMirror view code (ProseMirror.tsx, nodes/NodeView.tsx,
    // NativeWidgetView.tsx, refs.ts, useComponentEventListeners.tsx and the
    // view-description hooks), mostly refs written during render. Turn it on
    // for the Wordgard rewrite, with those files excepted until replaced.
    rules: {
      "no-console": ["error", { allow: ["error"] }],
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": [
        "warn",
        {
          additionalHooks:
            "(useEditorEffect|useLayoutGroupEffect|useClientLayoutEffect$)",
        },
      ],
      "sort-imports": [
        "error",
        { allowSeparatedGroups: true, ignoreDeclarationSort: true },
      ],
      // The TypeScript compiler checks this.
      "@typescript-eslint/no-unused-vars": "off",
      // viewdesc.ts, copied from ProseMirror, uses ternaries as statements.
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowTernary: true },
      ],
    },
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
    files: ["*.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  prettier,
);
