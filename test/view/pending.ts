// Wordgard tests the React view can't pass yet, skipped in the `view` project
// (vite.config.ts). Each sits under the first unsupported thing it hits.
// Remove entries as support lands.
// Names as Vitest prints them: file > describe > it.
export const pendingWordgardTests = {
  // Widgets, Wordgard's own and from decorations (R4's next slice).
  widgets: [
    "webtest-content.ts > DocTile > decoration > can draw widgets around nodes",
    "webtest-content.ts > DocTile > decoration > can draw widgets from a point set",
    "webtest-content.ts > DocTile > decoration > can handle changes from range and point decorations in a single transactions",
    "webtest-content.ts > DocTile > decoration > can redraw widgets at the end of the document",
    "webtest-content.ts > DocTile > decoration > can reuse widgets when replacing next to them",
    "webtest-content.ts > DocTile > decoration > can reuse widgets when updating across them",
    "webtest-content.ts > DocTile > decoration > can update widgets from a point set",
    "webtest-content.ts > DocTile > decoration > can update widgets in place",
    "webtest-content.ts > DocTile > decoration > doesn't break spanning wrappers on widgets",
    "webtest-content.ts > DocTile > decoration > doesn't duplicate widgets on section boundaries",
    "webtest-content.ts > DocTile > decoration > orders widgets by side",
    "webtest-content.ts > DocTile > decoration > updates tag widgets at the end of a changed plot",
    "webtest-editor.ts > Wordgard > calls connect/disconnect on widgets",
    "webtest-resolve-dom.ts > DocTile.resolve > picks the right side of widgets on wrapper boundaries",
    "webtest-resolve-dom.ts > DocTile.resolve > resolves properly between widgets",
  ],
  // DOM nodes Wordgard moves into a new parent and React recreates: when a
  // wrapper's element changes (<strong> to <em>) or a node gets a wrapper,
  // React remounts what it holds. Keys can't help; react-prosemirror has the
  // same limit.
  reparent: [
    "webtest-content.ts > DocTile > decoration > can reuse DOM structure when adding a shape wrapper",
    "webtest-content.ts > DocTile > preserves DOM nodes with changed wrappers marks",
  ],
};
