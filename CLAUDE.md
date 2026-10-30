# CLAUDE.md

react-wordgard: a skeleton for a React view over Wordgard (`wordgard` on npm),
derived from react-prosemirror. The view code is still ProseMirror-based;
`wordgard` is installed and only covered by a smoke test.

- Package manager: npm.
- Build: `npm run build` (swc for ESM/CJS, tsc for types).
- Types: `npm run check:types`.
- Tests: `npm run test:unit` (jest), `npm run test:wdio` (WebdriverIO, needs a
  local Chrome).
- Keep the copyright headers and LICENSE.txt.
