// Named after react-prosemirror's EditorContext, rewritten for Wordgard: the editor's value
// (editorStore.ts), which never changes, so memoised components aren't scanned for it.
import { createContext, useContext } from "react";

import type { EditorValue } from "../editorStore.js";

export const EditorContext = createContext<EditorValue | null>(null);

export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) throw new Error("Used outside a Wordgard editor");
  return context;
};
