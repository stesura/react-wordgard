// React shapes: a node drawn by a component
// that renders its content as `children` and changes its chrome and attributes
// on its own, from editor state inside the flush, wrapped, while the user types
// or composes, and with chrome beside a container's content; and React
// wrappers, drawn around what they wrap, the same ways. After each
// change, Wordgard's next flush must find nothing to redraw, and the tiles must
// be what a fresh build over the same DOM gives.
import React, { createContext, forwardRef, useContext, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Elt, Leaf } from "wordgard/doc";
import { Decoration, Widget, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import { GardState } from "wordgard/state";
import { Blockquote, Cell, Image, Paragraph, Table, TableRow } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { type ShapeComponentProps, createShape } from "../decorations/ReactShapeType.js";
import { type WidgetComponentProps, createWidgetType } from "../decorations/ReactWidgetType.js";
import { type WrapperComponentProps, createWrapper } from "../decorations/ReactWrapperType.js";
import { useEditorStateSelector } from "../hooks/useEditorStateSelector.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { composeIn, drawn, flushKeeps, textIn, typeInto } from "../testing/editing.js";

// What the components start with, and their setters, by editor, innermost
// first.
const initial = { bar: true, label: "a", exact: false };
type Control = {
  setBar: (on: boolean) => void;
  setLabel: (label: string) => void;
  getPos: () => number;
};
const controls = new Map<Wordgard, Control[]>();
const rows = new Map<Wordgard, (exact: boolean) => void>();

// A title bar shown from its own state, a label attribute from its own state,
// a count of the document's blocks once there are more than two (editor
// state), and the content in `div.body`.
const Callout = forwardRef<HTMLDivElement, ShapeComponentProps<HTMLDivElement>>(
  ({ nodeProps, children, ...attrs }, ref) => {
    const wg = useWordgard();
    const [bar, setBar] = useState(initial.bar);
    const [label, setLabel] = useState(initial.label);
    const blocks = useEditorStateSelector((state) => state.doc.content.length);
    useLayoutEffect(() => {
      const control: Control = {
        setBar: (on) => flushSync(() => setBar(on)),
        setLabel: (label) => flushSync(() => setLabel(label)),
        getPos: nodeProps.getPos,
      };
      controls.set(wg, [...(controls.get(wg) ?? []), control]);
    }, [wg, nodeProps.getPos]);
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

const CalloutShape = createShape({ component: Callout });

// Stesura's exact rows: a row tells its cells, through a context, to clip
// their content in an extra element, so React remounts the content there.
const Exact = createContext(false);

const RowView = forwardRef<HTMLTableRowElement, ShapeComponentProps<HTMLTableRowElement>>(
  ({ nodeProps, children, ...attrs }, ref) => {
    const wg = useWordgard();
    const [exact, setExact] = useState(initial.exact);
    useLayoutEffect(() => {
      rows.set(wg, (on) => flushSync(() => setExact(on)));
    }, [wg]);
    return (
      <Exact.Provider value={exact}>
        <tr {...attrs} ref={ref}>
          {children}
        </tr>
      </Exact.Provider>
    );
  }
);

const CellView = forwardRef<HTMLTableCellElement, ShapeComponentProps<HTMLTableCellElement>>(
  ({ nodeProps, children, ...attrs }, ref) =>
    useContext(Exact) ? (
      <td {...attrs} ref={ref}>
        <div className="clip" ref={nodeProps.contentDOMRef}>
          {children}
        </div>
      </td>
    ) : (
      <td {...attrs} ref={ref}>
        {children}
      </td>
    )
);

// Chrome beside a container's content, in the same element (Stesura's slots):
// a lead shown from its own state before the paragraphs, a tail after them.
const leads = new Map<Wordgard, (on: boolean) => void>();

const QuoteView = forwardRef<HTMLQuoteElement, ShapeComponentProps<HTMLQuoteElement>>(
  ({ nodeProps, children, ...attrs }, ref) => {
    const wg = useWordgard();
    const [lead, setLead] = useState(true);
    useLayoutEffect(() => {
      leads.set(wg, (on) => flushSync(() => setLead(on)));
    }, [wg]);
    return (
      <blockquote {...attrs} ref={ref}>
        {lead && <span className="lead">·</span>}
        {children}
        <span className="tail">!</span>
      </blockquote>
    );
  }
);

const doc = "<p>a</p><blockquote><p>bc</p></blockquote>";
const config = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, CalloutShape),
  extra,
];

const tableDoc = "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>";
const tableConfig = [
  basicSchema(),
  GardState.schemaElement.of([Table, TableRow, Cell]),
  Decoration.Tag.shape(TableRow, createShape({ component: RowView, element: "tr" })),
  Decoration.Tag.shape(Cell, createShape({ component: CellView, element: "td" })),
];

// Widgets in a cell's content, native and React, counting connections.
const connected = { native: 0 };
const NativeMark = Widget.define<null>({
  render: () => Object.assign(document.createElement("span"), { className: "native" }),
  connect: () => connected.native++,
  disconnect: () => connected.native--,
});
const ReactMark = createWidgetType({
  component: forwardRef<HTMLElement, WidgetComponentProps<null>>((_, ref) => (
    <i ref={ref} className="react" />
  )),
});
const cellWidgets = Decoration.Point.source.of(() =>
  Decoration.Point.set([
    [Decoration.Point.widget(NativeMark.of(null)), 3],
    [Decoration.Point.widget(ReactMark.of(null), { side: 1 }), 3],
  ])
);

// A React wrapper: a header from its own state, a label attribute from its
// own state, what it wraps moved into `div.deep` from its own state (React
// remounts it), and a footer.
const framed = { header: true, deep: false };
type FrameControl = {
  setHeader: (on: boolean) => void;
  setLabel: (label: string) => void;
  setDeep: (on: boolean) => void;
  getPos: () => number;
};
const frames = new Map<Wordgard, FrameControl[]>();

const Frame = forwardRef<HTMLElement, WrapperComponentProps>(
  ({ nodeProps, children, ...attrs }, ref) => {
    const wg = useWordgard();
    const [header, setHeader] = useState(framed.header);
    const [label, setLabel] = useState("a");
    const [deep, setDeep] = useState(framed.deep);
    useLayoutEffect(() => {
      const control: FrameControl = {
        setHeader: (on) => flushSync(() => setHeader(on)),
        setLabel: (label) => flushSync(() => setLabel(label)),
        setDeep: (on) => flushSync(() => setDeep(on)),
        getPos: nodeProps.getPos,
      };
      frames.set(wg, [...(frames.get(wg) ?? []), control]);
    }, [wg, nodeProps.getPos]);
    return (
      <section {...attrs} ref={ref} data-frame={label}>
        {header && (
          <header>
            Frame <b>x</b>
          </header>
        )}
        {deep ? <div className="deep">{children}</div> : children}
        <footer>end</footer>
      </section>
    );
  }
);

const FrameWrapper = createWrapper({ component: Frame, element: "section" });

// Around an inline atom: a badge from its own state. It leaves out the
// attributes, `contenteditable` among them: the build makes it uneditable.
const InlineFrame = forwardRef<HTMLSpanElement, WrapperComponentProps<HTMLSpanElement>>(
  ({ nodeProps, children }, ref) => {
    const wg = useWordgard();
    const [badge, setBadge] = useState(framed.header);
    useLayoutEffect(() => {
      const control: FrameControl = {
        setHeader: (on) => flushSync(() => setBadge(on)),
        setLabel: () => {},
        setDeep: () => {},
        getPos: nodeProps.getPos,
      };
      frames.set(wg, [...(frames.get(wg) ?? []), control]);
    }, [wg, nodeProps.getPos]);
    return (
      <span ref={ref}>
        {badge && <i className="badge">*</i>}
        {children}
      </span>
    );
  }
);

const Picture = createWidgetType({
  component: forwardRef<HTMLImageElement, WidgetComponentProps<null>>((_, ref) => (
    <img ref={ref} className="picture" alt="" />
  )),
});

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  controls.clear();
  rows.clear();
  leads.clear();
  frames.clear();
  connected.native = 0;
  Object.assign(initial, { bar: true, label: "a", exact: false });
  Object.assign(framed, { header: true, deep: false });
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension } = {}) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? ReactWordgard.create({ state: spec.state, parent })
    : ReactWordgard.create({ doc: spec.doc ?? doc, config: spec.config ?? config(), parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const control = (wg: Wordgard, index = 0) => {
  const found = controls.get(wg)?.[index];
  if (!found) throw new Error("No callout drawn");
  return found;
};

const row = (wg: Wordgard) => {
  const found = rows.get(wg);
  if (!found) throw new Error("No row drawn");
  return found;
};

// What a fresh editor draws for the same state, its components starting where
// `wg`'s are.
const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

describe("React shapes", () => {
  it("draws the component, with the content in its content element", () => {
    const wg = create();
    const html = wg.contentDOM.innerHTML;
    expect(html).toContain('<div class="body"><p>bc</p></div>');
    expect(html).not.toContain("data-wg-react");
    expect(wg.contentDOM.querySelector(".bar")?.getAttribute("contenteditable")).toBe("false");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("gives the component the node's position", () => {
    const wg = create();
    expect(control(wg).getPos()).toBe(3);
    wg.dispatch({ changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    wg.flush();
    expect(control(wg).getPos()).toBe(8);
  });

  it("keeps the tiles right when the component changes its chrome on its own", async () => {
    const wg = create();
    control(wg).setBar(false);
    expect(wg.contentDOM.querySelector(".bar")).toBeNull();
    // The observer's callback, a microtask after the commit, rebuilds the
    // tiles, before any flush.
    await Promise.resolve();
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    initial.bar = true;
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    control(wg).setBar(true);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the attributes the component sets on its own", () => {
    const wg = create();
    control(wg).setLabel("b");
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("[data-label]")?.getAttribute("data-label")).toBe("b");
  });

  it("rebuilds a shape whose chrome changes with the editor state, inside the flush", () => {
    const wg = create();
    wg.dispatch({ changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    wg.flush();
    expect(wg.contentDOM.querySelector(".count")?.textContent).toBe("3");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the tiles right in a wrapped shape", () => {
    const wg = create({
      config: config(Decoration.Tag.wrapper(Blockquote, Elt.mk("section", [0]))),
    });
    expect(wg.contentDOM.querySelector("section > [data-label] > .body")).not.toBeNull();
    control(wg).setBar(false);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a shape a point decoration gives one node", () => {
    const wg = create({
      doc: "<p>a</p><p>b</p>",
      config: [
        basicSchema(),
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.shape(CalloutShape), 3]])
        ),
      ],
    });
    expect(wg.contentDOM.innerHTML).toMatch(
      /^<p>a<\/p><div data-label="a">.*<div class="body">b<\/div><\/div>$/
    );
    control(wg).setBar(false);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".body"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("bx");
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("takes the user's typing in its content, with the chrome changing before the flush", () => {
    const wg = create();
    typeInto(wg, textIn(wg, ".body p"), 1, "x");
    control(wg).setBar(false);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps a composition in its content while the chrome changes", () => {
    const wg = create();
    const sel = document.getSelection();
    const node = textIn(wg, ".body p");
    const composition = composeIn(wg, node);
    composition.update(1, "-");
    wg.flush();
    control(wg).setBar(false);
    expect(sel?.focusNode).toBe(node);
    composition.update(2, "*");
    wg.flush();
    expect(sel?.focusNode).toBe(node);
    expect(node.isConnected).toBe(true);
    composition.end();
    wg.flush();
    expect(String(wg.state.doc)).toContain("b-*c");
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows content React remounts in another element, from a context", () => {
    const wg = create({ doc: tableDoc, config: tableConfig });
    expect(wg.contentDOM.querySelector("td")?.innerHTML).toBe("a");
    expect(drawn(wg)).toEqual(fresh(wg));
    row(wg)(true);
    expect(wg.contentDOM.querySelector("td")?.innerHTML).toBe('<div class="clip">a</div>');
    expect(flushKeeps(wg)).toBe(true);
    initial.exact = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".clip"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("ax");
    row(wg)(false);
    expect(flushKeeps(wg)).toBe(true);
    initial.exact = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("moves the widgets of content React remounts, drawn and connected once", async () => {
    const wg = create({ doc: tableDoc, config: [tableConfig, cellWidgets] });
    const cell = () => wg.contentDOM.querySelector("td")?.innerHTML;
    const widgets =
      '<span class="native" contenteditable="false"></span><i class="react" contenteditable="false"></i>';
    expect(cell()).toBe(`${widgets}a`);
    expect(connected.native).toBe(1);
    row(wg)(true);
    await Promise.resolve();
    expect(cell()).toBe(`<div class="clip">${widgets}a</div>`);
    expect(wg.contentDOM.querySelectorAll(".native, .react").length).toBe(2);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    row(wg)(false);
    await Promise.resolve();
    expect(cell()).toBe(`${widgets}a`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    // A fresh editor connects a widget of its own.
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("takes a deletion in its content, with the chrome changing before the flush", () => {
    const wg = create();
    wg.focus();
    const text = textIn(wg, ".body p");
    const range = new StaticRange({
      startContainer: text,
      startOffset: 0,
      endContainer: text,
      endOffset: 1,
    });
    document.getSelection()?.setBaseAndExtent(text, 1, text, 1);
    const init = { inputType: "deleteContentBackward" };
    const before = new InputEvent("beforeinput", init);
    before.getTargetRanges = () => [range];
    wg.contentDOM.dispatchEvent(before);
    text.deleteData(0, 1);
    wg.contentDOM.dispatchEvent(new InputEvent("input", init));
    control(wg).setBar(false);
    wg.flush();
    expect(String(wg.state.doc)).toContain('"c"');
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps nested shapes right when either changes on its own", () => {
    const wg = create({ doc: "<blockquote><blockquote><p>a</p></blockquote></blockquote>" });
    expect(wg.contentDOM.querySelectorAll("[data-label]").length).toBe(2);
    const [inner, outer] = [control(wg, 0), control(wg, 1)];
    expect([outer.getPos(), inner.getPos()]).toEqual([0, 1]);
    inner.setBar(false);
    expect(flushKeeps(wg)).toBe(true);
    outer.setBar(false);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".body .body p"), 1, "x");
    inner.setBar(true);
    wg.flush();
    expect(String(wg.state.doc)).toContain("ax");
    expect(wg.contentDOM.querySelectorAll(".bar").length).toBe(1);
  });

  it("keeps chrome beside a container's content, in its content element", () => {
    const wg = create({
      doc: "<blockquote><p>a</p><p>b</p></blockquote>",
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(
          Blockquote,
          createShape({ component: QuoteView, element: "blockquote" })
        ),
      ],
    });
    const quote = () => wg.contentDOM.querySelector("blockquote")?.innerHTML;
    const lead = '<span class="lead" contenteditable="false">·</span>';
    const tail = '<span class="tail" contenteditable="false">!</span>';
    expect(quote()).toBe(`${lead}<p>a</p><p>b</p>${tail}`);
    const toggle = leads.get(wg);
    if (!toggle) throw new Error("No quote drawn");
    toggle(false);
    expect(quote()).toBe(`<p>a</p><p>b</p>${tail}`);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("ax");
    toggle(true);
    expect(flushKeeps(wg)).toBe(true);
    expect(quote()).toBe(`${lead}<p>ax</p><p>b</p>${tail}`);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("says when the component's root isn't the shape's element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    create({
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, createShape({ component: Callout, element: "section" })),
      ],
    });
    expect(error.mock.calls.flat().join("")).toContain("drew <div> where its shape says <section>");
    error.mockRestore();
  });

  it("refuses a React shape for a leaf, as Wordgard does a shape with a hole", () => {
    expect(() =>
      create({
        doc: '<p><img src="data:,"></p>',
        config: [basicSchema(), image(), Decoration.Tag.shape(Image, CalloutShape)],
      })
    ).toThrow(/Leaf nodes shapes shouldn't have a content hole/);
  });
});

const frame = (wg: Wordgard, index = 0) => {
  const found = frames.get(wg)?.[index];
  if (!found) throw new Error("No frame drawn");
  return found;
};

const framedParagraphs = (extra: GardState.Extension = []) => ({
  doc: "<p>ab</p><p>c</p>",
  config: [basicSchema(), Decoration.Tag.wrapper(Paragraph, FrameWrapper), extra],
});

const pictureConfig = (wrapper: Elt) => ({
  doc: '<p>a<img src="data:,">b</p>',
  config: [
    basicSchema(),
    image(),
    Decoration.Tag.shape(Image, Picture.of(null)),
    Decoration.Tag.wrapper(Image, wrapper),
  ],
});

describe("React wrappers", () => {
  it("draws the component around the node, with its chrome uneditable", () => {
    const wg = create(framedParagraphs());
    const html = wg.contentDOM.innerHTML;
    expect(html).toMatch(/^<section data-frame="a"><header contenteditable="false">.*<p>ab<\/p>/);
    expect(html).not.toContain("data-wg-react");
    expect(wg.contentDOM.querySelector("footer")?.getAttribute("contenteditable")).toBe("false");
    expect([frame(wg, 0).getPos(), frame(wg, 1).getPos()]).toEqual([0, 4]);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the tiles right when the component changes its chrome on its own", async () => {
    const wg = create(framedParagraphs());
    frame(wg).setHeader(false);
    await Promise.resolve();
    expect(wg.contentDOM.querySelectorAll("header").length).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    frame(wg, 1).setHeader(false);
    await Promise.resolve();
    framed.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
  });

  it("keeps the attributes the component sets on its own", () => {
    const wg = create(framedParagraphs());
    frame(wg).setLabel("b");
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("section")?.getAttribute("data-frame")).toBe("b");
  });

  it("takes the user's typing in what it wraps, with the chrome changing before the flush", async () => {
    const wg = create(framedParagraphs());
    typeInto(wg, textIn(wg, "section p"), 1, "x");
    frame(wg).setHeader(false);
    wg.flush();
    expect(String(wg.state.doc)).toContain("axb");
    frame(wg, 1).setHeader(false);
    await Promise.resolve();
    framed.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("leaves Wordgard the mutations in what it wraps, which it redraws", async () => {
    const wg = create(framedParagraphs());
    // A script's: no beforeinput, so Wordgard puts back what the document says.
    textIn(wg, "section p").insertData(1, "x");
    await Promise.resolve();
    wg.flush();
    expect(wg.contentDOM.querySelector("section p")?.textContent).toBe("ab");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows what it wraps when React remounts it elsewhere", async () => {
    const wg = create(framedParagraphs());
    frame(wg).setDeep(true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("section > .deep > p")?.textContent).toBe("ab");
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".deep p"), 2, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("abx");
    frame(wg, 1).setDeep(true);
    await Promise.resolve();
    framed.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    frame(wg).setDeep(false);
    frame(wg, 1).setDeep(false);
    expect(flushKeeps(wg)).toBe(true);
    framed.deep = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("wraps the element its target picks, inside the node's shape", async () => {
    const wg = create({
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(
          Blockquote,
          Elt.mk("div", { class: "quote" }, [Elt.mk("blockquote", [0])])
        ),
        Decoration.Tag.wrapper(Blockquote, FrameWrapper, { target: "blockquote" }),
      ],
    });
    expect(wg.contentDOM.querySelector("div.quote > section > blockquote > p")).not.toBeNull();
    expect(frame(wg).getPos()).toBe(3);
    frame(wg).setHeader(false);
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    frame(wg).setDeep(true);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    Object.assign(framed, { header: false, deep: true });
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("wraps a React shape, either changing on its own", () => {
    const wg = create({ config: config(Decoration.Tag.wrapper(Blockquote, FrameWrapper)) });
    expect(wg.contentDOM.querySelector("section > [data-label] > .body > p")).not.toBeNull();
    expect([frame(wg).getPos(), control(wg).getPos()]).toEqual([3, 3]);
    control(wg).setBar(false);
    expect(flushKeeps(wg)).toBe(true);
    frame(wg).setHeader(false);
    expect(flushKeeps(wg)).toBe(true);
    Object.assign(initial, { bar: false });
    framed.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".body p"), 1, "x");
    // React remounts the shape: a new component, with a control of its own.
    frame(wg).setDeep(true);
    control(wg, 1).setBar(true);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    Object.assign(initial, { bar: true });
    framed.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a wrapper a point decoration gives one node", () => {
    const wg = create({
      doc: "<p>a</p><p>b</p>",
      config: [
        basicSchema(),
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.wrapper(FrameWrapper), 3]])
        ),
      ],
    });
    expect(wg.contentDOM.innerHTML).toMatch(/^<p>a<\/p><section data-frame="a">.*<p>b<\/p>/);
    frame(wg).setHeader(false);
    expect(flushKeeps(wg)).toBe(true);
    framed.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("wraps an atom a React widget draws, uneditable", async () => {
    const wg = create(pictureConfig(createWrapper({ component: InlineFrame, element: "span" })));
    const wrapper = wg.contentDOM.querySelector("p > span");
    expect(wrapper?.getAttribute("contenteditable")).toBe("false");
    expect(wrapper?.innerHTML).toBe(
      '<i class="badge" contenteditable="false">*</i><img class="picture" alt="">'
    );
    expect(frame(wg).getPos()).toBe(2);
    expect(drawn(wg)).toEqual(fresh(wg));
    frame(wg).setHeader(false);
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    framed.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("refuses to wrap a native widget, which it couldn't place", () => {
    expect(() =>
      create({
        doc: '<p>a<img src="data:,">b</p>',
        config: [
          basicSchema(),
          image(),
          Decoration.Tag.shape(Image, NativeMark.of(null)),
          Decoration.Tag.wrapper(Image, createWrapper({ component: InlineFrame, element: "span" })),
        ],
      })
    ).toThrow(/can't wrap a native widget/);
  });

  it("connects the widgets of what React remounts once", async () => {
    const wg = create({
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(
          Blockquote,
          Elt.mk("div", [NativeMark.of(null), Elt.mk("blockquote", [0])])
        ),
        Decoration.Tag.wrapper(Blockquote, FrameWrapper),
      ],
    });
    expect(connected.native).toBe(1);
    frame(wg).setDeep(true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelectorAll(".native").length).toBe(1);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    framed.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("nests, in a React wrapper or a plain one", async () => {
    const wg = create(
      framedParagraphs([
        Decoration.Tag.wrapper(Paragraph, FrameWrapper),
        Decoration.Tag.wrapper(Paragraph, Elt.mk("aside", [0])),
      ])
    );
    expect(wg.contentDOM.querySelector("aside > section > section > p")).not.toBeNull();
    // Per paragraph, the inner wrapper's component first.
    expect([frame(wg, 0).getPos(), frame(wg, 1).getPos()]).toEqual([0, 0]);
    // The inner wrappers move what they wrap, the outer ones drop their header.
    const change = async (editor: Wordgard) => {
      for (const [i, control] of (frames.get(editor) ?? []).entries())
        if (i % 2) control.setHeader(false);
        else control.setDeep(true);
      await Promise.resolve();
    };
    await change(wg);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".deep p"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("axb");
    const ours = drawn(wg);
    const theirs = create({ state: wg.state });
    await change(theirs);
    expect(ours).toEqual(drawn(theirs));
  });

  it("refuses a React shape as a wrapper and a React wrapper as a shape", () => {
    expect(() => create(framedParagraphs(Decoration.Tag.wrapper(Paragraph, CalloutShape)))).toThrow(
      /use createWrapper/
    );
    expect(() =>
      create({
        config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, FrameWrapper)],
      })
    ).toThrow(/use createShape/);
  });

  it("says when the component doesn't draw what it wraps", () => {
    const Bare = forwardRef<HTMLElement, WrapperComponentProps>((_, ref) => <section ref={ref} />);
    expect(() =>
      create(
        framedParagraphs(
          Decoration.Tag.wrapper(Paragraph, createWrapper({ component: Bare, element: "section" }))
        )
      )
    ).toThrow(/must draw its children/);
  });

  it("says when the component's root isn't the wrapper's element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    create(
      framedParagraphs(Decoration.Tag.wrapper(Paragraph, createWrapper({ component: Frame })))
    );
    expect(error.mock.calls.flat().join("")).toContain(
      "drew <section> where its wrapper says <div>"
    );
    error.mockRestore();
  });
});
