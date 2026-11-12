// Wordgard tests the React view can't pass yet, skipped in the `view` and
// `view-vue` projects (vite.config.ts): Vue fails the same ones. Each sits
// under the first unsupported thing it hits. Remove entries as support lands.
// Names as Vitest prints them: file > describe > it.
export const pendingWordgardTests = {
  // DOM nodes Wordgard moves into a new parent and React recreates: when a
  // wrapper's element changes (<strong> to <em>) or a node gets a wrapper,
  // React (and Vue) remount what it holds. Keys can't help; react-prosemirror
  // has the same limit.
  reparent: [
    "webtest-content.ts > DocTile > decoration > can reuse DOM structure when adding a shape wrapper",
    "webtest-content.ts > DocTile > preserves DOM nodes with changed wrappers marks",
  ],
};
