// The React decorations plan's spike (docs/react-decorations-plan.md, step 1):
// a React shape whose component changes its chrome and attributes on its own,
// from editor state inside the flush, wrapped, and while the user types.
// After each change, Wordgard's next flush must find nothing to redraw, and
// the tiles must be what a fresh build over the same DOM gives.
import React, { forwardRef, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Elt, Leaf } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote, Paragraph } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { type ShapeViewComponentProps, reactShape } from "../decorations/ReactShapeType.js";
import { useEditorStateSelector } from "../hooks/useEditorStateSelector.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { describeTile, docTileOf } from "../testing/tiles.js";

// What a callout's component starts with, and its setters, by editor.
const initial = { bar: true, label: "a" };
const controls = new Map<
  Wordgard,
  { setBar: (on: boolean) => void; setLabel: (label: string) => void }
>();

// A title bar shown from its own state, a label attribute from its own state,
// a count of the document's blocks once there are more than two (editor
// state), and the content in `div.body`.
const Callout = forwardRef<HTMLDivElement, ShapeViewComponentProps<HTMLDivElement>>(
  ({ nodeProps, children, ...attrs }, ref) => {
    const wg = useWordgard();
    const [bar, setBar] = useState(initial.bar);
    const [label, setLabel] = useState(initial.label);
    const blocks = useEditorStateSelector((state) => state.doc.content.length);
    useLayoutEffect(() => {
      controls.set(wg, {
        setBar: (on) => flushSync(() => setBar(on)),
        setLabel: (label) => flushSync(() => setLabel(label)),
      });
    }, [wg]);
    return (
      <div {...attrs} ref={ref} data-label={label}>
        {bar && (
          <div className="bar">
            Bar <b>x</b>
          </div>
        )}
        {blocks > 2 && <span className="count">{blocks}</span>}
        <div className="body" ref={nodeProps.contentDOMRef}>
          {children}
        </div>
      </div>
    );
  }
);

const CalloutShape = reactShape({ component: Callout });

const doc = "<p>a</p><blockquote><p>bc</p></blockquote>";
const config = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, CalloutShape),
  extra,
];

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  controls.clear();
  initial.bar = true;
  initial.label = "a";
});

const create = (spec: { doc?: string; state?: GardState; extra?: GardState.Extension }) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? ReactWordgard.create({ state: spec.state, parent })
    : ReactWordgard.create({ doc: spec.doc ?? doc, config: config(spec.extra), parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const control = (wg: Wordgard) => {
  const found = controls.get(wg);
  if (!found) throw new Error("No callout drawn");
  return found;
};

// The tiles and DOM a fresh editor builds for the same state, with the
// callout's component starting where `wg`'s is.
const fresh = (wg: Wordgard) => {
  const other = create({ state: wg.state });
  return {
    tiles: describeTile(docTileOf(other), other.contentDOM),
    html: other.contentDOM.innerHTML,
  };
};

const drawn = (wg: Wordgard) => ({
  tiles: describeTile(docTileOf(wg), wg.contentDOM),
  html: wg.contentDOM.innerHTML,
});

// A flush with nothing to redraw keeps the doc tile.
const flushKeeps = (wg: Wordgard) => {
  const tile = docTileOf(wg);
  wg.flush();
  return docTileOf(wg) == tile;
};

describe("React shapes (spike)", () => {
  it("draws the component, with the content in its content element", () => {
    const wg = create({});
    const html = wg.contentDOM.innerHTML;
    expect(html).toContain('<div class="body"><p>bc</p></div>');
    expect(html).not.toContain("data-wg-react");
    expect(wg.contentDOM.querySelector(".bar")?.getAttribute("contenteditable")).toBe("false");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the tiles right when the component changes its chrome on its own", () => {
    const wg = create({});
    control(wg).setBar(false);
    expect(wg.contentDOM.querySelector(".bar")).toBeNull();
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    control(wg).setBar(true);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the attributes the component sets on its own", () => {
    const wg = create({});
    control(wg).setLabel("b");
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("[data-label]")?.getAttribute("data-label")).toBe("b");
  });

  it("rebuilds a shape whose chrome changes with the editor state, inside the flush", () => {
    const wg = create({});
    wg.dispatch({ changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    wg.flush();
    expect(wg.contentDOM.querySelector(".count")?.textContent).toBe("3");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the tiles right in a wrapped shape", () => {
    const wg = create({ extra: Decoration.Tag.wrapper(Blockquote, Elt.mk("section", [0])) });
    expect(wg.contentDOM.querySelector("section > [data-label] > .body")).not.toBeNull();
    control(wg).setBar(false);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("takes the user's typing in its content, with the chrome changing before the flush", () => {
    const wg = create({});
    wg.focus();
    const text = wg.contentDOM.querySelector(".body p")?.firstChild;
    if (!(text instanceof Text)) throw new Error("No text in the callout");
    const range = new StaticRange({
      startContainer: text,
      startOffset: 1,
      endContainer: text,
      endOffset: 1,
    });
    document.getSelection()?.setBaseAndExtent(text, 1, text, 1);
    const init = { inputType: "insertText", data: "x" };
    const before = new InputEvent("beforeinput", init);
    before.getTargetRanges = () => [range];
    wg.contentDOM.dispatchEvent(before);
    text.insertData(1, "x");
    wg.contentDOM.dispatchEvent(new InputEvent("input", init));
    control(wg).setBar(false);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});
