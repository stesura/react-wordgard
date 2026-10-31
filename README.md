# react-wordgard

> **Work in progress.** Nothing here is ready to use yet.

A starting point for a React view over
[Wordgard](https://www.npmjs.com/package/wordgard).

This repository is derived from
[react-prosemirror](https://github.com/handlewithcarecollective/react-prosemirror),
by [Handle with Care Collective](https://github.com/handlewithcarecollective)
and originally The New York Times Company. Thanks to them for the design this
builds on. The view code, in `src/prosemirror/`, is still upstream's ProseMirror
view, plus these changes for large documents:

- Node, mark, text and widget views place their view description among their
  siblings with a binary search instead of re-sorting the sibling list.
- The `reactKeys` plugin keeps its key tables for transactions that only change
  attributes or node marks.
- `<ProseMirror>` takes an opt-in `stableContexts` prop.
- A node view's first render decides `contentEditable` from the schema.
- `ReactEditorView` detaches the React-rendered children around the base
  constructor's attribute changes.

`wordgard` is installed but not used yet. For the current API, see upstream's
README.

## Development

Needs Node 22.12 or later.

```sh
npm install
npx playwright install chromium  # once, for the browser tests
npm run build
npm run check                    # types, lint, format
npm test                         # unit (jsdom) and browser (Chromium) tests
npm run demo                     # the demo, on Vite's dev server
npm run bench                    # times ReactWordgard, Wordgard, react-prosemirror and ProseMirror
```

The benchmark (`bench/`, not part of the package) uses React's production build; `npm run
bench:dev` uses the development build and `npm run bench:smoke` checks it runs. Run it on an idle
machine, on mains power.

## Licence

MIT, © 2026 Edoardo Caratti, see [LICENSE.txt](LICENSE.txt).

Includes code from react-prosemirror (© Handle with Care Collective and The New
York Times Company) and ProseMirror (© Marijn Haverbeke and others); their
notices are in [THIRD_PARTY_LICENSES.txt](THIRD_PARTY_LICENSES.txt).
