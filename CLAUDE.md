# CLAUDE.md

react-wordgard: a skeleton for a React view over Wordgard (`wordgard` on npm),
derived from react-prosemirror. The view code is still ProseMirror-based;
`wordgard` is installed and only covered by smoke tests. The plan is
`docs/react-wordgard-plan.md`.

- Package manager: npm. Node 22.12 or later.
- Build: `npm run build` (tsc, ESM only, to `dist/`).
- Checks: `npm run check` (tsc, ESLint, Prettier); `npm run fix` fixes what it
  can.
- Tests: `npm test` (Vitest). Two projects in `vite.config.ts`: `unit` (jsdom,
  `*.test.ts(x)`) and `browser` (Chromium through Playwright,
  `*.browser.test.ts(x)`; run `npx playwright install chromium` once).
- Demo: `npm run demo` (Vite dev server, still the ProseMirror view).
- Licensing: LICENSE.txt is MIT, © Edoardo Caratti. Keep the "Copyright (c) The
  New York Times Company" headers on files from react-prosemirror. Code copied
  from another project (react-prosemirror, ProseMirror, Wordgard's tests) needs
  its notice in THIRD_PARTY_LICENSES.txt.
- Commits and pull requests: never add an AI agent (Claude or any other) as a
  co-author or contributor. No `Co-Authored-By` trailers, no "Generated with"
  lines.
