// React marks: a mark drawn by a
// component that renders the marked content as `children`, with chrome and
// attributes from its own state, content React remounts, one component per run
// of the mark, compositions inside it. After each change, Wordgard's next flush
// must find nothing to redraw, and the tiles must be what a fresh editor builds.
import React, { forwardRef, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Leaf, type Mark } from "wordgard/doc";
import { Decoration, Widget, type Wordgard } from "wordgard/editor";
import { basicSchema, color, image } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Color, Link } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { type MarkComponentProps, createMarkShape } from "../decorations/ReactMarkType.js";
import { useEditorStateSelector } from "../hooks/useEditorStateSelector.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { composeIn, drawn, flushKeeps, textIn, typeInto } from "../testing/editing.js";

// What the components start with, and their controls, by editor, in the order
// they mount.
const initial = { icon: true, boxed: false };
type Control = {
  setIcon: (on: boolean) => void;
  setTitle: (title: string) => void;
  setBoxed: (on: boolean) => void;
  getPos: () => number;
  mark: () => Mark;
};
const controls = new Map<Wordgard, Control[]>();

// A link: an icon shown from its own state, a title from its own state, and
// the content in `span.text`, or in `span.box > b` when boxed (React keeps the
// span as the box and remounts the content in the `b`).
const LinkView = forwardRef<HTMLAnchorElement, MarkComponentProps<HTMLAnchorElement>>(
  ({ markProps, children, ...attrs }, ref) => {
    const wg = useWordgard();
    const [icon, setIcon] = useState(initial.icon);
    const [title, setTitle] = useState("a");
    const [boxed, setBoxed] = useState(initial.boxed);
    const { mark, getPos, contentDOMRef } = markProps;
    const [latest] = useState(() => ({ mark }));
    latest.mark = mark;
    useLayoutEffect(() => {
      const control: Control = {
        setIcon: (on) => flushSync(() => setIcon(on)),
        setTitle: (title) => flushSync(() => setTitle(title)),
        setBoxed: (on) => flushSync(() => setBoxed(on)),
        getPos,
        mark: () => latest.mark,
      };
      controls.set(wg, [...(controls.get(wg) ?? []), control]);
    }, [wg, getPos, latest]);
    return (
      <a {...attrs} ref={ref} href={String(mark.value)} title={title}>
        {icon && <i className="icon">^</i>}
        {boxed ? (
          <span className="box">
            <b ref={contentDOMRef}>{children}</b>
          </span>
        ) : (
          <span className="text" ref={contentDOMRef}>
            {children}
          </span>
        )}
      </a>
    );
  }
);

// Content in its root, no chrome.
const ColorView = forwardRef<HTMLSpanElement, MarkComponentProps<HTMLSpanElement>>(
  ({ markProps, children }, ref) => (
    <span ref={ref} className="color" data-color={String(markProps.mark.value)}>
      {children}
    </span>
  )
);

const connected = { native: 0 };
const NativeMark = Widget.define<null>({
  render: () => Object.assign(document.createElement("span"), { className: "native" }),
  connect: () => connected.native++,
  disconnect: () => connected.native--,
});

// Chrome from the editor state: a marker while the cursor is in "bc", as a
// link's toolbar would show.
const CursorView = forwardRef<HTMLSpanElement, MarkComponentProps<HTMLSpanElement>>(
  ({ markProps, children }, ref) => {
    const here = useEditorStateSelector(
      ({ selection }) => selection.from > 2 && selection.from < 4
    );
    return (
      <span ref={ref} className="cursor">
        {here && <i className="here">*</i>}
        <span ref={markProps.contentDOMRef}>{children}</span>
      </span>
    );
  }
);

const linkConfig = (extra: GardState.Extension = []) => [
  basicSchema(),
  image(),
  Decoration.Mark.shape(Link, createMarkShape(LinkView, { element: "a" })),
  extra,
];

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  controls.clear();
  connected.native = 0;
  Object.assign(initial, { icon: true, boxed: false });
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension } = {}) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? ReactWordgard.create({ state: spec.state, parent })
    : ReactWordgard.create({
        doc: spec.doc ?? '<p>a<a href="x">bc</a>d</p>',
        config: spec.config ?? linkConfig(),
        parent,
      });
  wg.flush();
  editors.push(wg);
  return wg;
};

// What a fresh editor draws for the same state, its components starting where
// `wg`'s are.
const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

const control = (wg: Wordgard, index = 0) => {
  const found = controls.get(wg)?.[index];
  if (!found) throw new Error("No link drawn");
  return found;
};

const icon = '<i class="icon" contenteditable="false">^</i>';

describe("React marks", () => {
  it("draws the component around the marked content, with the document's mark", () => {
    const wg = create();
    expect(wg.contentDOM.innerHTML).toBe(
      `<p>a<a href="x" title="a">${icon}<span class="text">bc</span></a>d</p>`
    );
    expect(control(wg).getPos()).toBe(2);
    expect(control(wg).mark().type).toBe(Link);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the tiles right when the component changes its chrome on its own", async () => {
    const wg = create();
    control(wg).setIcon(false);
    await Promise.resolve();
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
    control(wg).setIcon(true);
    expect(flushKeeps(wg)).toBe(true);
    initial.icon = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the attributes the component sets on its own", () => {
    const wg = create();
    control(wg).setTitle("b");
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("a")?.title).toBe("b");
  });

  it("takes the user's typing in its content, with the chrome changing before the flush", () => {
    const wg = create();
    typeInto(wg, textIn(wg, "a .text"), 1, "x");
    control(wg).setIcon(false);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows content React remounts in another element", async () => {
    const wg = create();
    control(wg).setBoxed(true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("a .box b")?.textContent).toBe("bc");
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "a .box b"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.boxed = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("moves the widgets of content React remounts, drawn and connected once", async () => {
    const wg = create({
      config: linkConfig(
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.widget(NativeMark.of(null)), 3]])
        )
      ),
    });
    const native = '<span class="native" contenteditable="false"></span>';
    expect(wg.contentDOM.querySelector("a .text")?.innerHTML).toBe(`b${native}c`);
    expect(connected.native).toBe(1);
    control(wg).setBoxed(true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("a .box")?.innerHTML).toBe(`<b>b${native}c</b>`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    initial.boxed = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    // The fresh editor connected a widget of its own.
    connected.native--;
    initial.boxed = false;
    control(wg).setBoxed(false);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("a .text")?.innerHTML).toBe(`b${native}c`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps a composition in its content while the chrome changes", () => {
    const wg = create();
    const sel = document.getSelection();
    const node = textIn(wg, "a .text");
    const composition = composeIn(wg, node);
    composition.update(1, "-");
    wg.flush();
    control(wg).setIcon(false);
    expect(sel?.focusNode).toBe(node);
    composition.update(2, "*");
    wg.flush();
    expect(sel?.focusNode).toBe(node);
    expect(node.isConnected).toBe(true);
    composition.end();
    wg.flush();
    expect(String(wg.state.doc)).toContain("b-*c");
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws one component around a run, other marks and inline nodes inside", () => {
    const wg = create({
      doc: '<p>a<a href="x">b<strong>c</strong><img src="data:,">d</a>e</p>',
    });
    expect(wg.contentDOM.querySelectorAll("a").length).toBe(1);
    expect(wg.contentDOM.querySelector("a .text")?.innerHTML).toMatch(
      /^b<strong>c<\/strong><img [^>]*>d$/
    );
    expect(control(wg).getPos()).toBe(2);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a component per mark where the marks differ", () => {
    const wg = create({ doc: '<p><a href="x">b</a><a href="y">c</a></p>' });
    expect([...wg.contentDOM.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "x",
      "y",
    ]);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("gives the component its new mark when it changes", () => {
    const wg = create();
    wg.dispatch({
      changes: { from: 2, to: 4, insert: [Leaf.text("bc", [Link.of("y")])] },
    });
    wg.flush();
    expect(wg.contentDOM.querySelector("a")?.getAttribute("href")).toBe("y");
    // The same component, or one React mounted for the new mark.
    expect(controls.get(wg)?.at(-1)?.mark().value).toBe("y");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("turns an attribute-shaped mark into a wrapper", () => {
    const wg = create({
      doc: '<p>a<span style="color: red">bc</span>d</p>',
      config: [basicSchema(), color(), Decoration.Mark.shape(Color, createMarkShape(ColorView))],
    });
    expect(wg.contentDOM.innerHTML).toBe('<p>a<span class="color" data-color="red">bc</span>d</p>');
    typeInto(wg, textIn(wg, ".color"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("rebuilds a mark the editor state changes in a flush that only moves the selection", () => {
    const wg = create({
      config: [basicSchema(), Decoration.Mark.shape(Link, createMarkShape(CursorView))],
    });
    expect(wg.contentDOM.querySelector(".here")).toBeNull();
    wg.dispatch({ selection: { anchor: 3 } });
    wg.flush();
    expect(wg.contentDOM.querySelector(".here")?.getAttribute("contenteditable")).toBe("false");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("says when the component's root isn't the mark's element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    create({
      config: [basicSchema(), Decoration.Mark.shape(Link, createMarkShape(LinkView))],
    });
    expect(error.mock.calls.flat().join("")).toContain("drew <a> where its mark says <span>");
    error.mockRestore();
  });
});
