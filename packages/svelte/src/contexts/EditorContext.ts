// Adapted from react-wordgard's EditorContext.ts (by way of vue-wordgard's) for Svelte: the editor
// and its store, set as a context for the components the editor draws and those inside
// WordgardEditor. `DocumentKey` marks the components the editor draws, with the editor: one inside
// a decoration of another editor isn't the outer's.
import { getContext } from "svelte";

import type { EditorValue } from "@stesura/wordgard-view";

export const EditorKey = Symbol("editor");

export const DocumentKey = Symbol("document");

export const useEditorContext = (composable: string) => {
  const editor = getContext<EditorValue | undefined>(EditorKey);
  if (!editor) throw new Error(`${composable} is used outside a Wordgard editor`);
  return editor;
};

// Whether the calling component is drawn by `wg`.
export const inDocument = (wg: unknown) => getContext<unknown>(DocumentKey) === wg;
