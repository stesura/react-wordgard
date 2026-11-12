// React shapes and wrappers. After each change, Wordgard's next flush must find nothing to redraw,
// and the tiles must be what a fresh build over the same DOM gives.
import React, {
  createContext,
  createElement,
  forwardRef,
  useContext,
  useLayoutEffect,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Elt, Leaf } from "wordgard/doc";
import { Decoration, Widget, type Wordgard } from "wordgard/editor";
import { alignment, basicSchema, blockquote, figure, image, imageResizing } from "wordgard/schema";
import { GardSelection, GardState } from "wordgard/state";
import {
  Alignment,
  Blockquote,
  Cell,
  Figure,
  Heading,
  Image,
  ImageSize,
  Paragraph,
  Table,
  TableRow,
} from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { type ShapeComponentProps, createShape } from "../decorations/ReactShapeType.js";
import { type WidgetComponentProps, createWidgetType } from "../decorations/ReactWidgetType.js";
import { type WrapperComponentProps, createWrapper } from "../decorations/ReactWrapperType.js";
import { useEditorStateSelector } from "../hooks/useEditorStateSelector.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { composeIn, drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { docTileOf } from "../../../../test/tiles.js";

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

const CalloutShape = createShape(Callout);

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
  Decoration.Tag.shape(Blockquote, CalloutShape.of("div")),
  extra,
];

const tableDoc = "<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>";
const tableConfig = [
  basicSchema(),
  GardState.schemaElement.of([Table, TableRow, Cell]),
  Decoration.Tag.shape(TableRow, createShape(RowView)),
  Decoration.Tag.shape(Cell, createShape(CellView)),
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

const FrameWrapper = createWrapper(Frame, { element: "section" });

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
    expect(html).not.toContain("data-wg-component");
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

  // Wordgard's style comes as an object, so a root drawn by hand merges it
  // with its own.
  it("gives a root drawn by hand Wordgard's style to merge with its own", () => {
    const Styled = createShape(
      forwardRef<HTMLParagraphElement, ShapeComponentProps<HTMLParagraphElement>>(
        ({ nodeProps: _, children, style, ...attrs }, ref) => (
          <p {...attrs} ref={ref} style={{ ...style, color: "red" }}>
            {children}
          </p>
        )
      )
    );
    const wg = create({
      doc: '<p style="text-align: center">a</p>',
      config: [basicSchema(), alignment(), Decoration.Tag.shape(Paragraph, Styled)],
    });
    const p = wg.contentDOM.querySelector("p");
    expect(p?.style.textAlign).toBe("center");
    expect(p?.style.color).toBe("red");
    wg.dispatch({
      changes: [
        { from: 0, remove: Alignment.of("center") },
        { from: 0, add: Alignment.of("end") },
      ],
    });
    wg.flush();
    expect(p?.style.textAlign).toBe("end");
    expect(p?.style.color).toBe("red");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the attributes the component sets on its own", () => {
    const wg = create();
    control(wg).setLabel("b");
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("[data-label]")?.getAttribute("data-label")).toBe("b");
  });

  // Code outside React (a resize observer, a layout engine) marking a node's
  // element.
  it("keeps an attribute set by hand on its root, until React sets that attribute", async () => {
    const wg = create();
    const root = wg.contentDOM.querySelector("[data-label]");
    if (!root) throw new Error("No callout");
    root.setAttribute("data-pending", "1");
    root.classList.add("moving");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    // An edit in its content, the component's own re-render, an edit
    // re-rendering it from the flush.
    typeInto(wg, textIn(wg, ".body p"), 1, "x");
    wg.flush();
    control(wg).setLabel("b");
    await Promise.resolve();
    wg.flush();
    wg.dispatch({ changes: { from: 0, insert: [Paragraph.create()] } });
    wg.flush();
    expect(root.getAttribute("data-pending")).toBe("1");
    expect(root.classList.contains("moving")).toBe(true);
    // Selected, the node's class changes: React sets `className` again.
    const pos = control(wg).getPos();
    const node = wg.state.doc.nodeAt(pos);
    if (!node) throw new Error("No callout");
    wg.dispatch({ selection: GardSelection.node(pos, node) });
    wg.flush();
    expect(root.classList.contains("wg-selected-node")).toBe(true);
    expect(root.classList.contains("moving")).toBe(false);
    expect(root.getAttribute("data-pending")).toBe("1");
  });

  it("undoes an attribute set by hand on a node drawn without React", async () => {
    const wg = create();
    const p = wg.contentDOM.querySelector(":scope > p");
    if (!p) throw new Error("No paragraph");
    p.setAttribute("data-pending", "1");
    await Promise.resolve();
    wg.flush();
    expect(p.hasAttribute("data-pending")).toBe(false);
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe("a|bc");
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
          Decoration.Point.set([[Decoration.Point.shape(CalloutShape.of("div")), 3]])
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

  // The content's nodes keep their views while React draws them anew: their
  // old tiles are over elements it removed.
  it("follows content React remounts in another element, from the editor state", () => {
    const Boxed = ({ nodeProps, children }: ShapeComponentProps) => {
      const boxed = useEditorStateSelector((state) => state.doc.content.length > 2);
      return (
        <DecorationRoot>
          {boxed ? (
            <div className="box" ref={nodeProps.contentDOMRef}>
              {children}
            </div>
          ) : (
            children
          )}
        </DecorationRoot>
      );
    };
    const wg = create({
      doc: "<blockquote><p>a</p><p>b</p></blockquote><p>c</p>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Boxed))],
    });
    wg.dispatch({
      changes: { from: wg.state.doc.length, insert: [Paragraph.create([Leaf.text("d")])] },
    });
    wg.flush();
    expect(wg.contentDOM.querySelector(".box")?.textContent).toBe("ab");
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".box p"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("ax");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // React mounts the document anew after an error: the nodes that keep their
  // views get tiles over the new elements.
  it("draws the document again after a component threw in an update", () => {
    const fail = { now: false };
    const Fragile = ({ children }: ShapeComponentProps) => {
      const length = useEditorStateSelector((state) => state.doc.length);
      if (fail.now) throw new Error("boom");
      return <DecorationRoot data-length={length}>{children}</DecorationRoot>;
    };
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote><p>c</p>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Fragile))],
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fail.now = true;
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(() => wg.flush()).toThrow("boom");
    errors.mockRestore();
    fail.now = false;
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("y")] } });
    wg.flush();
    expect(wg.contentDOM.querySelector("p")?.textContent).toBe("yxa");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws the document again after a component threw when only the selection moved", () => {
    const fail = { now: false };
    const Fragile = ({ children }: ShapeComponentProps) => {
      const head = useEditorStateSelector((state) => state.selection.head);
      if (fail.now) throw new Error("boom");
      return <DecorationRoot data-head={head}>{children}</DecorationRoot>;
    };
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Fragile))],
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    fail.now = true;
    wg.dispatch({ selection: { anchor: 2 } });
    expect(() => wg.flush()).toThrow("boom");
    errors.mockRestore();
    fail.now = false;
    wg.flush();
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-head")).toBe("2");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws the document again after a component threw on its own", () => {
    const control: { fail: (() => void) | null } = { fail: null };
    const Fragile = ({ children }: ShapeComponentProps) => {
      const [failed, setFailed] = useState(false);
      useLayoutEffect(() => {
        control.fail = () => flushSync(() => setFailed(true));
      }, []);
      if (failed) throw new Error("boom");
      return <DecorationRoot>{children}</DecorationRoot>;
    };
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Fragile))],
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    control.fail?.();
    errors.mockRestore();
    expect(wg.contentDOM.querySelector("blockquote")).toBeNull();
    wg.flush();
    expect(wg.contentDOM.querySelector("blockquote")?.textContent).toBe("b");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("moves the widgets of content React remounts, drawn and connected once", async () => {
    const wg = create({ doc: tableDoc, config: [tableConfig, cellWidgets] });
    const cell = () => wg.contentDOM.querySelector("td")?.innerHTML;
    const widgets = '<span class="native"></span><i class="react"></i>';
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
        Decoration.Tag.shape(Blockquote, createShape(QuoteView)),
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
        Decoration.Tag.shape(Blockquote, CalloutShape.of("section")),
      ],
    });
    expect(error.mock.calls.flat().join("")).toContain("drew <div> where its shape says <section>");
    create({
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, CalloutShape)],
    });
    expect(error.mock.calls.flat().join("")).toContain(
      "drew <div> where its shape says <blockquote>"
    );
    error.mockRestore();
  });

  it("refuses a React shape for a leaf, as Wordgard does a shape with a hole", () => {
    expect(() =>
      create({
        doc: '<p><img src="data:,"></p>',
        config: [basicSchema(), image(), Decoration.Tag.shape(Image, CalloutShape.of("div"))],
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
    expect(html).not.toContain("data-wg-component");
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

  // A node type's own structure shape, without a hole, with React chrome
  // around an element in it: the type's shape decides where the marks'
  // attributes go.
  it("wraps an element of a structure shape, the marks' attributes kept on it", async () => {
    const src = "data:image/svg+xml,";
    const wg = create({
      doc: `<figure><img src="${src}" alt="A cat"></figure><p>a</p>`,
      config: [
        basicSchema(),
        figure(),
        imageResizing(),
        Decoration.Tag.wrapper(Figure, FrameWrapper, { target: "img" }),
      ],
    });
    wg.dispatch({ changes: { from: 0, add: ImageSize.of(30) } });
    wg.flush();
    const img = wg.contentDOM.querySelector("figure > section > img");
    expect(img?.getAttribute("src")).toBe(src);
    expect(img?.getAttribute("alt")).toBe("A cat");
    expect(img?.getAttribute("style")).toContain("width: 30px");
    expect(frame(wg).getPos()).toBe(0);
    frame(wg).setHeader(false);
    frame(wg).setLabel("b");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("figure > section > header")).toBeNull();
    // The size changes as a mark: the wrapper keeps its state.
    wg.dispatch({ changes: { from: 0, add: ImageSize.of(40) } });
    wg.flush();
    expect(wg.contentDOM.querySelector("figure > section > img")).toBe(img);
    expect(img?.getAttribute("style")).toContain("width: 40px");
    expect(wg.contentDOM.querySelector("section")?.getAttribute("data-frame")).toBe("b");
    typeInto(wg, textIn(wg, "p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe("|ax");
    framed.header = false;
    const other = fresh(wg);
    expect(drawn(wg).tiles).toEqual(other.tiles);
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
    const wg = create(pictureConfig(createWrapper(InlineFrame, { element: "span" })));
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
          Decoration.Tag.wrapper(Image, createWrapper(InlineFrame, { element: "span" })),
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

  // An empty element beside what it wraps is chrome, which the build makes
  // uneditable, until what it wraps moves into it.
  it("makes a chrome element editable again once what it wraps moves into it", () => {
    const move: { first: ((on: boolean) => void) | null } = { first: null };
    const Moving = createWrapper(
      function Moving({ children }) {
        const [first, setFirst] = useState(false);
        useLayoutEffect(() => {
          move.first = (on) => flushSync(() => setFirst(on));
        }, []);
        return (
          <DecorationRoot>
            <div className="a">{first && children}</div>
            <div className="b">{!first && children}</div>
          </DecorationRoot>
        );
      },
      { element: "section" }
    );
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.wrapper(Blockquote, Moving)],
    });
    expect(wg.contentDOM.querySelector(".a")?.getAttribute("contenteditable")).toBe("false");
    move.first?.(true);
    wg.flush();
    expect(wg.contentDOM.querySelector(".a > blockquote > p")?.textContent).toBe("b");
    expect(wg.contentDOM.querySelector(".a")?.hasAttribute("contenteditable")).toBe(false);
    typeInto(wg, textIn(wg, ".a p"), 1, "y");
    wg.flush();
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe("a|by");
  });

  it("refuses a React shape as a wrapper and a React wrapper as a shape", () => {
    expect(() =>
      create(framedParagraphs(Decoration.Tag.wrapper(Paragraph, CalloutShape.of("div"))))
    ).toThrow(/use createWrapper/);
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
          Decoration.Tag.wrapper(Paragraph, createWrapper(Bare, { element: "section" }))
        )
      )
    ).toThrow(/must draw its children/);
  });

  it("says when the component's root isn't the wrapper's element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    create(framedParagraphs(Decoration.Tag.wrapper(Paragraph, createWrapper(Frame))));
    expect(error.mock.calls.flat().join("")).toContain(
      "drew <section> where its wrapper says <div>"
    );
    error.mockRestore();
  });
});

// An inline atom (a mention-like chip) drawn by a component with chrome of
// its own state, and the component's mounts counted.
const Chip = Leaf.Type.define<string>("Chip", {
  inline: true,
  validate: "string",
  selectable: true,
  shape: {
    element: "span",
    selector: "span[data-chip]",
    attributes: (id) => ({ "data-chip": id }),
    readElement: (elt) => elt.getAttribute("data-chip") ?? "",
  },
});
const chips = { mounts: 0, open: false, setOpen: (_open: boolean) => {} };
const ChipShape = createShape(
  forwardRef<HTMLSpanElement, ShapeComponentProps<HTMLSpanElement>>(
    ({ nodeProps, children: _, ...attrs }, ref) => {
      const [open, setOpen] = useState(chips.open);
      useLayoutEffect(() => {
        chips.mounts++;
        chips.setOpen = (open) => flushSync(() => setOpen(open));
      }, []);
      return (
        <span {...attrs} ref={ref}>
          @{String(nodeProps.node.isLeaf ? nodeProps.node.param : "")}
          {open && <b className="card">card</b>}
        </span>
      );
    }
  )
);

// A block leaf, a figure, its image from the node's parameter.
const FigureShape = createShape(
  forwardRef<HTMLElement, ShapeComponentProps>(({ nodeProps, children: _, ...attrs }, ref) => (
    <figure {...attrs} ref={ref}>
      <img src={String(nodeProps.node.isLeaf ? nodeProps.node.param : "")} alt="" />
    </figure>
  ))
);

// A blockquote drawn as an atom: its content isn't drawn.
const QuoteAtom = createShape(
  forwardRef<HTMLDivElement, ShapeComponentProps<HTMLDivElement>>(
    ({ nodeProps, children: _, ...attrs }, ref) => (
      <div {...attrs} ref={ref} className="quote">
        “{nodeProps.node.isPlot ? nodeProps.node.textContent() : ""}”
      </div>
    )
  )
);

// A heading, its root following the level.
const HeadingShape = createShape(
  forwardRef<HTMLHeadingElement, ShapeComponentProps<HTMLHeadingElement>>(
    ({ nodeProps, children, ...attrs }, ref) =>
      createElement(
        `h${nodeProps.node.isPlot ? String(nodeProps.node.tag.param) : ""}`,
        { ...attrs, ref },
        children
      )
  )
);

describe("React shapes drawing atoms", () => {
  afterEach(() => Object.assign(chips, { mounts: 0, open: false }));

  const chipConfig = [
    basicSchema(),
    GardState.schemaElement.of(Chip),
    Decoration.Tag.shape(Chip, ChipShape),
  ];
  const chipDoc = '<p>a<span data-chip="ada"></span>b</p>';

  it("draws an inline atom from the node type's element, its chrome uneditable", () => {
    const wg = create({ doc: chipDoc, config: chipConfig });
    const chip = wg.contentDOM.querySelector("span[data-chip='ada']");
    expect(chip?.textContent).toBe("@ada");
    expect(chip?.getAttribute("contenteditable")).toBe("false");
    expect(wg.contentDOM.innerHTML).not.toContain("data-wg-component");
    expect(docTileOf(wg).nodeTile(2)?.dom).toBe(chip);
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
  });

  it("keeps the tiles right when an atom's component changes its chrome on its own", async () => {
    const wg = create({ doc: chipDoc, config: chipConfig });
    chips.setOpen(true);
    expect(wg.contentDOM.querySelector(".card")).not.toBeNull();
    await Promise.resolve();
    chips.open = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
  });

  it("keeps an atom's component through its selection, the class on its root", () => {
    const wg = create({ doc: chipDoc, config: chipConfig });
    const chip = wg.contentDOM.querySelector("span[data-chip]");
    const found = wg.state.doc.nodeAt(2);
    if (!found) throw new Error("No chip");
    wg.dispatch({ selection: GardSelection.node(2, found) });
    wg.flush();
    expect(wg.contentDOM.querySelector("span[data-chip]")).toBe(chip);
    expect(chip?.classList.contains("wg-selected-node")).toBe(true);
    expect(chips.mounts).toBe(1);
    // React adds the class after the attributes it first set.
    expect(drawn(wg).tiles).toEqual(fresh(wg).tiles);
  });

  it("draws a block leaf and a plot drawn as an atom", () => {
    const src = "data:image/svg+xml,";
    const wg = create({
      doc: `<p>a</p><figure><img src="${src}"></figure><blockquote><p>q</p></blockquote><p>b</p>`,
      config: [
        basicSchema(),
        blockquote(),
        figure(),
        Decoration.Tag.shape(Figure, FigureShape),
        Decoration.Tag.shape(Blockquote, QuoteAtom.of("div", { atom: true })),
      ],
    });
    expect(wg.contentDOM.querySelector("figure img")?.getAttribute("src")).toBe(src);
    expect(wg.contentDOM.querySelector(".quote")?.textContent).toBe("“q”");
    expect(wg.contentDOM.querySelector(".quote p")).toBeNull();
    const figureNode = wg.state.doc.content[1];
    expect(docTileOf(wg).nodeTile(3)?.dom).toBe(wg.contentDOM.querySelector("figure"));
    expect(docTileOf(wg).nodeTile(3 + (figureNode?.length ?? 0))?.dom).toBe(
      wg.contentDOM.querySelector(".quote")
    );
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "p:last-child"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe("a|q|bx");
  });

  it("draws an image from its type's attributes and its marks", () => {
    const ImageShape = createShape(
      forwardRef<HTMLImageElement, ShapeComponentProps<HTMLImageElement>>(
        ({ nodeProps: _, ...attrs }, ref) => <img {...attrs} ref={ref} />
      )
    );
    const src = "data:image/svg+xml,";
    const wg = create({
      doc: `<p>a<img src="${src}" alt="A cat">b</p>`,
      config: [basicSchema(), image(), Decoration.Tag.shape(Image, ImageShape)],
    });
    const img = wg.contentDOM.querySelector("img");
    expect(img?.getAttribute("src")).toBe(src);
    expect(img?.getAttribute("alt")).toBe("A cat");
    expect(docTileOf(wg).nodeTile(2)?.dom).toBe(img);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("refuses a content element in an atom", () => {
    const WithContent = createShape(
      forwardRef<HTMLSpanElement, ShapeComponentProps<HTMLSpanElement>>(
        ({ nodeProps, ...attrs }, ref) => (
          <span {...attrs} ref={ref}>
            <span ref={nodeProps.contentDOMRef} />
          </span>
        )
      )
    );
    expect(() =>
      create({
        doc: chipDoc,
        config: [
          basicSchema(),
          GardState.schemaElement.of(Chip),
          Decoration.Tag.shape(Chip, WithContent),
        ],
      })
    ).toThrow(/drop its contentDOMRef/);
  });

  it("draws a wrapper around an atom, and an atom from a point shape", async () => {
    const wg = create({
      doc: chipDoc,
      config: [...chipConfig, Decoration.Tag.wrapper(Chip, Elt.mk("span", { class: "w" }, [0]))],
    });
    expect(wg.contentDOM.querySelector(".w > span[data-chip]")?.textContent).toBe("@ada");
    chips.setOpen(true);
    await Promise.resolve();
    chips.open = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
    // A point shape has no type to take attributes from.
    chips.open = false;
    const point = create({
      doc: chipDoc,
      config: [
        basicSchema(),
        GardState.schemaElement.of(Chip),
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.shape(ChipShape.of("span", { atom: true })), 2]])
        ),
      ],
    });
    expect(point.contentDOM.querySelector("p > span:not([data-chip])")?.textContent).toBe("@ada");
    expect(drawn(point)).toEqual(fresh(point));
  });

  it("gives a heading's root its level", () => {
    const error = vi.spyOn(console, "error");
    const wg = create({
      doc: "<h1>a</h1><h3>b</h3>",
      config: [basicSchema(), Decoration.Tag.shape(Heading, HeadingShape)],
    });
    expect(wg.contentDOM.innerHTML).toBe("<h1>a</h1><h3>b</h3>");
    expect(error).not.toHaveBeenCalled();
    expect(drawn(wg)).toEqual(fresh(wg));
    error.mockRestore();
  });
});

// Line numbers beside a paragraph's text: a React shape provides the number
// from its own state, a tag widget at the paragraph's start draws it, and the
// paragraph's content element holds only its text.
const Line = createContext(0);
const lines = { setLine: (_line: number) => {} };
const LineShape = createShape(
  forwardRef<HTMLParagraphElement, ShapeComponentProps<HTMLParagraphElement>>(
    ({ nodeProps: _, children, ...attrs }, ref) => {
      const [line, setLine] = useState(1);
      useLayoutEffect(() => {
        lines.setLine = (line) => flushSync(() => setLine(line));
      }, []);
      return (
        <Line.Provider value={line}>
          <p {...attrs} ref={ref}>
            {children}
          </p>
        </Line.Provider>
      );
    }
  )
);
const LineNumber = createWidgetType({
  component: forwardRef<HTMLSpanElement, WidgetComponentProps<null>>((_, ref) => (
    <span ref={ref} className="line" aria-hidden="true">
      {useContext(Line)}
    </span>
  )),
});

describe("Chrome beside a textblock's text", () => {
  const lineConfig = [
    basicSchema(),
    Decoration.Tag.shape(Paragraph, LineShape),
    Decoration.Tag.widget(Paragraph, "start", LineNumber.of(null)),
  ];
  // A paragraph's text node, after its number.
  const lineText = (wg: Wordgard, index = 0) => {
    const text = wg.contentDOM.children[index]?.lastChild;
    if (!(text instanceof Text)) throw new Error("No text in the paragraph");
    return text;
  };
  const key = (wg: Wordgard, key: string, shiftKey = false) =>
    wg.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true }));

  it("draws a tag widget from the shape's context, the text beside it", () => {
    const wg = create({ doc: "<p>ab</p>", config: lineConfig });
    expect(wg.contentDOM.innerHTML).toBe('<p><span class="line" aria-hidden="true">1</span>ab</p>');
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("changes the number on its own, outside the flush", async () => {
    const wg = create({ doc: "<p>ab</p>", config: lineConfig });
    const tile = docTileOf(wg);
    lines.setLine(7);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector(".line")?.textContent).toBe("7");
    expect(flushKeeps(wg)).toBe(true);
    expect(docTileOf(wg)).toBe(tile);
    typeInto(wg, lineText(wg), 2, "c");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("abc");
    expect(wg.contentDOM.querySelector(".line")?.textContent).toBe("7");
  });

  it("takes typing and a composition at the paragraph's start", () => {
    const wg = create({ doc: "<p>ab</p>", config: lineConfig });
    typeInto(wg, lineText(wg), 0, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("xab");
    expect(drawn(wg)).toEqual(fresh(wg));
    const composition = composeIn(wg, lineText(wg));
    composition.update(0, "k");
    wg.flush();
    composition.end();
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("kxab");
    expect(wg.contentDOM.querySelector("p")?.firstChild).toBe(wg.contentDOM.querySelector(".line"));
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("moves and selects across the paragraph's start with arrow keys", () => {
    const wg = create({ doc: "<p>ab</p><p>cd</p>", config: lineConfig });
    wg.focus();
    wg.dispatch({ selection: { anchor: 6 } });
    wg.flush();
    key(wg, "ArrowLeft");
    wg.flush();
    expect(wg.state.selection.head).toBe(5);
    key(wg, "ArrowLeft");
    wg.flush();
    expect(wg.state.selection.head).toBe(3);
    key(wg, "ArrowRight");
    key(wg, "ArrowRight", true);
    wg.flush();
    expect([wg.state.selection.anchor, wg.state.selection.head]).toEqual([5, 6]);
    // The DOM selection is in the text, past the number.
    const selection = document.getSelection();
    expect(selection?.anchorNode).toBe(lineText(wg, 1));
    expect(selection?.anchorOffset).toBe(0);
  });
});
