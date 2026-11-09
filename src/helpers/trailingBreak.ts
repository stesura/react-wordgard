// Not in react-prosemirror, whose trailing `<br>` carries ProseMirror's class
// (`ProseMirror-trailingBreak`). Wordgard's has none, and react-wordgard draws Wordgard's DOM.
import { Widget } from "wordgard/editor";

/**
 * Whether `dom` is the `<br>` Wordgard puts at the end of a textblock to hold the cursor, not a
 * line break's. It adds no line of its own, except after a line break, where it holds the empty
 * last line. Reads the editor's tiles: a copy of the DOM doesn't tell.
 */
export const isTrailingBreak = (dom: Node): boolean => {
  const tile = dom.nodeName == "BR" ? dom.wgTile : undefined;
  return !!tile && "widget" in tile && tile.widget == Widget.br;
};
