# react-wordgard

> **Work in progress.** Nothing here is ready to use yet.

A starting point for a React view over
[Wordgard](https://www.npmjs.com/package/wordgard).

This repository is derived from
[react-prosemirror](https://github.com/handlewithcarecollective/react-prosemirror)
(© The New York Times Company and Handle with Care Collective, MIT). The view
code is still upstream's ProseMirror view, plus these changes for large
documents:

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

See [CONTRIBUTING.md](CONTRIBUTING.md). In short: `npm install`,
`npm run build`, `npm run check:types`, `npm test`.

## Licence

MIT, see [LICENSE.txt](LICENSE.txt).
