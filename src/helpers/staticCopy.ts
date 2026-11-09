// Not in react-prosemirror. Stesura's core rendered its static copies (a header's on every page) by
// serializing a fragment (`renderStaticContent`); what Wordgard draws comes partly from decorations a
// serializer doesn't see, so the copy is taken from what the editor drew.
import { isTrailingBreak } from "./trailingBreak.js";

const EDITOR_CLASSES = ["wg-selected-node", "wg-selected-cell"];

const TRAILING_BREAK = "wg-trailing-break";

/**
 * A copy of what an editor drew under `dom` (its content element, or a node's element), to lay out
 * as it does outside the editor: a header's copy on every page. It has no ids, which would repeat
 * the document's, and none of the editor's own: no `contenteditable`, no selection classes, none of
 * Wordgard's composition buffers. The `<br>`s Wordgard ends textblocks with get the class
 * `wg-trailing-break`, which only the editor's tiles tell from a line break's.
 */
export const staticCopy = (dom: Element): Element => {
  const copy = dom.cloneNode(true);
  if (!(copy instanceof Element)) throw new Error("Not an element");
  const sources = dom.querySelectorAll("br");
  copy.querySelectorAll("br").forEach((br, i) => {
    const source = sources[i];
    if (source && isTrailingBreak(source)) br.classList.add(TRAILING_BREAK);
  });
  copy.querySelectorAll("img.wg-buffer").forEach((buffer) => buffer.remove());
  for (const element of [copy, ...copy.querySelectorAll("*")]) {
    element.removeAttribute("id");
    element.removeAttribute("contenteditable");
    if (EDITOR_CLASSES.some((name) => element.classList.contains(name))) {
      element.classList.remove(...EDITOR_CLASSES);
      if (!element.classList.length) element.removeAttribute("class");
    }
  }
  return copy;
};
