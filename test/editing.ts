// The user's typing and compositions as the browser fires them, and the drawing a fresh editor is
// compared with.
import type { Wordgard } from "wordgard/editor";

import { TileFlag } from "@stesura/wordgard-view";
import { describeTile, docTileOf } from "./tiles.js";

// The tiles and DOM, to compare with a fresh editor's for the same state. A
// composition's flag is left out: a fresh editor has none.
export const drawn = (wg: Wordgard) => ({
  tiles: JSON.stringify(describeTile(docTileOf(wg), wg.contentDOM)).replace(
    /"flags":(\d+)/g,
    (_, flags) => `"flags":${Number(flags) & ~TileFlag.Composition}`
  ),
  html: wg.contentDOM.innerHTML,
});

// A flush with nothing to redraw keeps the doc tile.
export const flushKeeps = (wg: Wordgard) => {
  const tile = docTileOf(wg);
  wg.flush();
  return docTileOf(wg) == tile;
};

// Types `text` at `offset` in a text node as the browser does: Wordgard
// computes the change from `beforeinput` and lets the browser's edit through.
export const typeInto = (wg: Wordgard, text: Text, offset: number, data: string) => {
  wg.focus();
  const range = new StaticRange({
    startContainer: text,
    startOffset: offset,
    endContainer: text,
    endOffset: offset,
  });
  document.getSelection()?.setBaseAndExtent(text, offset, text, offset);
  const init = { inputType: "insertText", data };
  const before = new InputEvent("beforeinput", init);
  before.getTargetRanges = () => [range];
  wg.contentDOM.dispatchEvent(before);
  text.insertData(offset, data);
  wg.contentDOM.dispatchEvent(new InputEvent("input", init));
};

export const textIn = (wg: Wordgard, selector: string) => {
  const text = wg.contentDOM.querySelector(selector)?.firstChild;
  if (!(text instanceof Text)) throw new Error(`No text in ${selector}`);
  return text;
};

// An IME composition in a text node, as the browser fires it: started, then
// each update inserting text at an offset, then ended.
export const composeIn = (wg: Wordgard, node: Text) => {
  wg.focus();
  const fire = (event: Event) => wg.contentDOM.dispatchEvent(event);
  fire(new CompositionEvent("compositionstart"));
  return {
    update: (offset: number, text: string) => {
      fire(new CompositionEvent("compositionupdate"));
      const range = new StaticRange({
        startContainer: node,
        startOffset: offset,
        endContainer: node,
        endOffset: offset,
      });
      const init = { inputType: "insertCompositionText", data: text, isComposing: true };
      const before = new InputEvent("beforeinput", init);
      before.getTargetRanges = () => [range];
      fire(before);
      node.insertData(offset, text);
      document.getSelection()?.collapse(node, offset + text.length);
      fire(new InputEvent("input", init));
    },
    end: () => fire(new CompositionEvent("compositionend")),
  };
};
