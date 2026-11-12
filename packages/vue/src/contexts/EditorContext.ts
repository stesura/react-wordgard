// Adapted from react-wordgard's EditorContext.ts for Vue: the editor, provided through the app
// context VueDocTile gives the document's components (the core's editorStore.ts has the store).
// Also the node wrappers of the state the document is drawn from (NodeWrapperContext in
// react-wordgard).
import { type Component, type InjectionKey, type ShallowRef, inject } from "vue";

import type { EditorValue, NodeWrappers } from "@stesura/wordgard-view";

export const EditorKey: InjectionKey<EditorValue> = Symbol("editor");

export const NodeWrappersKey: InjectionKey<ShallowRef<NodeWrappers<Component>>> =
  Symbol("nodeWrappers");

export const useEditorContext = (composable: string) => {
  const editor = inject(EditorKey, null);
  if (!editor) throw new Error(`${composable} is used outside a Wordgard editor`);
  return editor;
};
