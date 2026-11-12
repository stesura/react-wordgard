// Adapted from react-wordgard's TextNodeView (by way of vue-wordgard's) for Svelte: a bare text
// node, written only when its text changed from what we last wrote. The browser's edits are
// undone before a draw (the core's `restore`), and a composition's node holds what we last wrote.
import type { DrawContext, Part, TextPart } from "./ChildNodeViews.js";

export const TextNodeView = (
  before: Part | undefined,
  key: string,
  text: string,
  { doc }: DrawContext
): TextPart => {
  if (before?.kind == "text") {
    if (before.text != text) before.dom.nodeValue = before.text = text;
    return before;
  }
  return { kind: "text", key, dom: doc.createTextNode(text), text };
};
