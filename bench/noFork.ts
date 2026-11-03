// Stands in for Stesura's fork of react-prosemirror when no checkout is found
// (vitest.config.ts): its row is left out, so none of this is called.
const missing = () => {
  throw new Error("No react-prosemirror checkout: Stesura's fork isn't benchmarked");
};

export const ProseMirror = missing;
export const ProseMirrorDoc = missing;
export const reactKeys = missing;
export const useEditorEffect = missing;
