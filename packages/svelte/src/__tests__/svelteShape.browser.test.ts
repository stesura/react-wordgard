// Adapted from vue-wordgard's vueShape.browser.test.ts for Svelte: Svelte shapes, wrappers and
// widgets, written as users write them (fixtures/shape/). The cases svelteDecorations already
// covers aren't repeated. After each change, Wordgard's next flush must find nothing to redraw, and
// the tiles must be what a fresh build over the same DOM gives.
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

import { tick } from "../testing/tick.js";
import { composeIn, drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { docTileOf } from "../../../../test/tiles.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import { createWrapper } from "../decorations/SvelteWrapperType.js";
import HeadingView from "./fixtures/Heading.svelte";
import Thrower from "./fixtures/Thrower.svelte";
import { controls, initial, reset } from "./fixtures/controls.js";
import AtomWithContent from "./fixtures/shape/AtomWithContent.svelte";
import Bare from "./fixtures/shape/Bare.svelte";
import Boxed from "./fixtures/shape/Boxed.svelte";
import Callout from "./fixtures/shape/Callout.svelte";
import CellView from "./fixtures/shape/Cell.svelte";
import Chip from "./fixtures/shape/Chip.svelte";
import ChromeInContent from "./fixtures/shape/ChromeInContent.svelte";
import FigureView from "./fixtures/shape/FigureView.svelte";
import Frame from "./fixtures/shape/Frame.svelte";
import HeadTeller from "./fixtures/shape/HeadTeller.svelte";
import ImageView from "./fixtures/shape/ImageView.svelte";
import InlineFrame from "./fixtures/shape/InlineFrame.svelte";
import LineNumber from "./fixtures/shape/LineNumber.svelte";
import LineShape from "./fixtures/shape/LineShape.svelte";
import Mark from "./fixtures/shape/Mark.svelte";
import Moving from "./fixtures/shape/Moving.svelte";
import Picture from "./fixtures/shape/Picture.svelte";
import Quote from "./fixtures/shape/Quote.svelte";
import QuoteAtom from "./fixtures/shape/QuoteAtom.svelte";
import RowView from "./fixtures/shape/Row.svelte";
import Styled from "./fixtures/shape/Styled.svelte";
import { counted, enlisted, resetShape, start } from "./fixtures/shape/state.js";

const CalloutShape = createShape(Callout);

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

// Widgets in a cell's content, native and Svelte, counting connections.
const connected = { native: 0 };
const NativeMark = Widget.define<null>({
  render: () => Object.assign(document.createElement("span"), { className: "native" }),
  connect: () => connected.native++,
  disconnect: () => connected.native--,
});
const SvelteMark = createWidgetType<null>({ component: Mark, element: "i" });
const cellWidgets = Decoration.Point.source.of(() =>
  Decoration.Point.set([
    [Decoration.Point.widget(NativeMark.of(null)), 3],
    [Decoration.Point.widget(SvelteMark.of(null), { side: 1 }), 3],
  ])
);

const FrameWrapper = createWrapper(Frame, { element: "section" });
const PictureType = createWidgetType<null>({ component: Picture, element: "img" });

const editors: SvelteWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  reset();
  resetShape();
  connected.native = 0;
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension } = {}) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? SvelteWordgard.create({ state: spec.state, parent })
    : SvelteWordgard.create({ doc: spec.doc ?? doc, config: spec.config ?? config(), parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const find = (wg: Wordgard, kind: string, index = 0) => {
  const found = enlisted(wg, kind)[index];
  if (!found) throw new Error(`No ${kind} drawn`);
  return found;
};

const callout = (wg: Wordgard, index = 0) => find(wg, "callout", index);
const frame = (wg: Wordgard, index = 0) => find(wg, "frame", index);

// Sets a component's state and waits for Svelte to draw it.
const set = async (
  control: { set: (name: string, value: unknown) => void },
  name: string,
  value: unknown
) => {
  control.set(name, value);
  await tick();
};

// What a fresh editor draws for the same state, its components starting where
// `wg`'s are.
const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

describe("Svelte shapes", () => {
  // Svelte has no attribute fallthrough: the component sets its own style
  // beside Wordgard's with a `style:` directive.
  it("merges Wordgard's style with the root's own", () => {
    const wg = create({
      doc: '<p style="text-align: center">a</p>',
      config: [basicSchema(), alignment(), Decoration.Tag.shape(Paragraph, createShape(Styled))],
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

  // Code outside Svelte (a resize observer, a layout engine) marking a node's
  // element.
  it("keeps an attribute set by hand on its root, until Svelte sets that attribute", async () => {
    const wg = create();
    const root = wg.contentDOM.querySelector("[data-label]");
    if (!root) throw new Error("No callout");
    root.setAttribute("data-pending", "1");
    root.classList.add("moving");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".body p"), 1, "x");
    wg.flush();
    await set(callout(wg), "label", "b");
    wg.flush();
    wg.dispatch({ changes: { from: 0, insert: [Paragraph.create()] } });
    wg.flush();
    expect(root.getAttribute("data-pending")).toBe("1");
    expect(root.classList.contains("moving")).toBe(true);
    // Selected, the node's class changes: Svelte sets `class` again.
    const pos = callout(wg).getPos();
    const node = wg.state.doc.nodeAt(pos);
    if (!node) throw new Error("No callout");
    wg.dispatch({ selection: GardSelection.node(pos, node) });
    wg.flush();
    expect(root.classList.contains("wg-selected-node")).toBe(true);
    expect(root.classList.contains("moving")).toBe(false);
    expect(root.getAttribute("data-pending")).toBe("1");
  });

  it("undoes an attribute set by hand on a node drawn without Svelte", async () => {
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

  it("keeps the tiles right in a wrapped shape", async () => {
    const wg = create({
      config: config(Decoration.Tag.wrapper(Blockquote, Elt.mk("section", [0]))),
    });
    expect(wg.contentDOM.querySelector("section > [data-label] > .body")).not.toBeNull();
    await set(callout(wg), "bar", false);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a shape a point decoration gives one node", async () => {
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
    await set(callout(wg), "bar", false);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".body"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("bx");
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps a composition in its content while the chrome changes", async () => {
    const wg = create();
    const sel = document.getSelection();
    const node = textIn(wg, ".body p");
    const composition = composeIn(wg, node);
    composition.update(1, "-");
    wg.flush();
    await set(callout(wg), "bar", false);
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

  it("follows content the component moves to another element, from a context", async () => {
    const wg = create({ doc: tableDoc, config: tableConfig });
    const row = find(wg, "row");
    expect(wg.contentDOM.querySelector("td")?.innerHTML).toBe("a");
    expect(drawn(wg)).toEqual(fresh(wg));
    await set(row, "exact", true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("td")?.innerHTML).toBe('<div class="clip">a</div>');
    expect(flushKeeps(wg)).toBe(true);
    start.exact = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".clip"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("ax");
    await set(row, "exact", false);
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    start.exact = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows content the component moves to another element, from the editor state", () => {
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

  it("draws the document again after a component threw when only the selection moved", () => {
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote>",
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, createShape(HeadTeller)),
      ],
    });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    initial.fail = true;
    wg.dispatch({ selection: { anchor: 2 } });
    expect(() => wg.flush()).toThrow("boom");
    initial.fail = false;
    wg.flush();
    errors.mockRestore();
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-head")).toBe("2");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // The failing instance keeps its state: the document drawn again has a new
  // one. Where Vue unmounts the document at once, the dead root stays until
  // the next flush.
  it("draws the document again after a component threw on its own", async () => {
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote>",
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, createShape(Thrower).of("div")),
      ],
    });
    const thrower = controls.get(wg)?.[0];
    if (!thrower) throw new Error("No shape drawn");
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const dead = wg.contentDOM.querySelector("[data-state]");
    await set(thrower, "broken", true);
    expect(errors).toHaveBeenCalledWith(new Error("Thrower"));
    errors.mockRestore();
    wg.flush();
    const root = wg.contentDOM.querySelector("[data-state]");
    expect(root).not.toBe(dead);
    expect(root?.textContent).toBe("b");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("moves the widgets of content it moves, drawn and connected once", async () => {
    const wg = create({ doc: tableDoc, config: [tableConfig, cellWidgets] });
    const row = find(wg, "row");
    const cell = () => wg.contentDOM.querySelector("td")?.innerHTML;
    const widgets = '<span class="native"></span><i class="svelte"></i>';
    expect(cell()).toBe(`${widgets}a`);
    expect(connected.native).toBe(1);
    await set(row, "exact", true);
    await Promise.resolve();
    expect(cell()).toBe(`<div class="clip">${widgets}a</div>`);
    expect(wg.contentDOM.querySelectorAll(".native, .svelte").length).toBe(2);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    await set(row, "exact", false);
    await Promise.resolve();
    expect(cell()).toBe(`${widgets}a`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("takes a deletion in its content, with the chrome changing before the flush", async () => {
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
    await set(callout(wg), "bar", false);
    wg.flush();
    expect(String(wg.state.doc)).toContain('"c"');
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps nested shapes right when either changes on its own", async () => {
    const wg = create({ doc: "<blockquote><blockquote><p>a</p></blockquote></blockquote>" });
    expect(wg.contentDOM.querySelectorAll("[data-label]").length).toBe(2);
    // The outer one mounts first: the inner one is drawn in its content.
    const [outer, inner] = [callout(wg, 0), callout(wg, 1)];
    expect([outer.getPos(), inner.getPos()]).toEqual([0, 1]);
    await set(inner, "bar", false);
    expect(flushKeeps(wg)).toBe(true);
    await set(outer, "bar", false);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".body .body p"), 1, "x");
    await set(inner, "bar", true);
    wg.flush();
    expect(String(wg.state.doc)).toContain("ax");
    expect(wg.contentDOM.querySelectorAll(".bar").length).toBe(1);
  });

  // Vue's case is anchors (a fragment in a slot) beside the content; Svelte's
  // content element holds the content only, so chrome in it is the mistake.
  it("refuses chrome in the content element", () => {
    expect(() =>
      create({
        doc: "<blockquote><p>a</p></blockquote>",
        config: [
          basicSchema(),
          blockquote(),
          Decoration.Tag.shape(Blockquote, createShape(ChromeInContent)),
        ],
      })
    ).toThrow("content element is drawn empty");
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
    expect(error.mock.calls.flat().join("")).toContain(
      "A Svelte shape's component drew <div> where its shape says <section>"
    );
    create({
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, CalloutShape)],
    });
    expect(error.mock.calls.flat().join("")).toContain(
      "drew <div> where its shape says <blockquote>"
    );
    error.mockRestore();
  });

  it("refuses a Svelte shape for a leaf, as Wordgard does a shape with a hole", () => {
    expect(() =>
      create({
        doc: '<p><img src="data:,"></p>',
        config: [basicSchema(), image(), Decoration.Tag.shape(Image, CalloutShape.of("div"))],
      })
    ).toThrow(/Leaf nodes shapes shouldn't have a content hole/);
  });
});

const framedParagraphs = (extra: GardState.Extension = []) => ({
  doc: "<p>ab</p><p>c</p>",
  config: [basicSchema(), Decoration.Tag.wrapper(Paragraph, FrameWrapper), extra],
});

const pictureConfig = (wrapper: Elt) => ({
  doc: '<p>a<img src="data:,">b</p>',
  config: [
    basicSchema(),
    image(),
    Decoration.Tag.shape(Image, PictureType.of(null)),
    Decoration.Tag.wrapper(Image, wrapper),
  ],
});

describe("Svelte wrappers", () => {
  it("keeps the attributes the component sets on its own", async () => {
    const wg = create(framedParagraphs());
    await set(frame(wg), "label", "b");
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("section")?.getAttribute("data-frame")).toBe("b");
  });

  it("takes the user's typing in what it wraps, with the chrome changing before the flush", async () => {
    const wg = create(framedParagraphs());
    typeInto(wg, textIn(wg, "section p"), 1, "x");
    await set(frame(wg), "header", false);
    wg.flush();
    expect(String(wg.state.doc)).toContain("axb");
    await set(frame(wg, 1), "header", false);
    initial.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // The second frame's label changes and the flush, for typing in the first
  // paragraph, comes before Svelte's: the renderer's `flushSync` commits it
  // there.
  it("commits the chrome's pending change inside the flush", async () => {
    const wg = create(framedParagraphs());
    typeInto(wg, textIn(wg, "section p"), 1, "x");
    frame(wg, 1).set("label", "b");
    wg.flush();
    expect(wg.contentDOM.querySelectorAll("section")[1]?.getAttribute("data-frame")).toBe("b");
    await tick();
    expect(String(wg.state.doc)).toContain("axb");
    expect(flushKeeps(wg)).toBe(true);
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

  it("follows what it wraps when the component moves it elsewhere", async () => {
    const wg = create(framedParagraphs());
    await set(frame(wg), "deep", true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("section > .deep > p")?.textContent).toBe("ab");
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".deep p"), 2, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("abx");
    await set(frame(wg, 1), "deep", true);
    await Promise.resolve();
    initial.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    await set(frame(wg), "deep", false);
    await set(frame(wg, 1), "deep", false);
    expect(flushKeeps(wg)).toBe(true);
    initial.deep = false;
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
    await set(frame(wg), "header", false);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    await set(frame(wg), "deep", true);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    Object.assign(initial, { header: false, deep: true });
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // A node type's own structure shape, without a hole, with Svelte chrome
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
    await set(frame(wg), "header", false);
    await set(frame(wg), "label", "b");
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
    initial.header = false;
    const other = fresh(wg);
    expect(drawn(wg).tiles).toEqual(other.tiles);
  });

  it("wraps a Svelte shape, either changing on its own", async () => {
    const wg = create({ config: config(Decoration.Tag.wrapper(Blockquote, FrameWrapper)) });
    expect(wg.contentDOM.querySelector("section > [data-label] > .body > p")).not.toBeNull();
    expect([frame(wg).getPos(), callout(wg).getPos()]).toEqual([3, 3]);
    await set(callout(wg), "bar", false);
    expect(flushKeeps(wg)).toBe(true);
    await set(frame(wg), "header", false);
    expect(flushKeeps(wg)).toBe(true);
    initial.bar = false;
    initial.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".body p"), 1, "x");
    // Svelte keeps the shape where React and Vue remount it: the same
    // component, its own state kept.
    await set(frame(wg), "deep", true);
    await set(callout(wg), "bar", true);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.bar = true;
    initial.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a wrapper a point decoration gives one node", async () => {
    const wg = create({
      doc: "<p>a</p><p>b</p>",
      config: [
        basicSchema(),
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.wrapper(FrameWrapper), 3]])
        ),
      ],
    });
    expect(wg.contentDOM.innerHTML).toMatch(/^<p>a<\/p><section data-frame="a"><p>b<\/p>/);
    await set(frame(wg), "header", false);
    expect(flushKeeps(wg)).toBe(true);
    initial.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("wraps an atom a Svelte widget draws, uneditable", async () => {
    const wg = create(pictureConfig(createWrapper(InlineFrame, { element: "span" })));
    const wrapper = wg.contentDOM.querySelector("p > span");
    expect(wrapper?.getAttribute("contenteditable")).toBe("false");
    // What it wraps first, then the badge.
    expect(wrapper?.innerHTML).toBe(
      '<img contenteditable="false" class="picture" alt=""><i class="badge" contenteditable="false">*</i><!---->'
    );
    expect(frame(wg).getPos()).toBe(2);
    expect(drawn(wg)).toEqual(fresh(wg));
    await set(frame(wg), "header", false);
    expect(flushKeeps(wg)).toBe(true);
    initial.header = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("refuses to wrap a native widget, which it couldn't place", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
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
    error.mockRestore();
  });

  it("connects the widgets of what it moves once", async () => {
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
    await set(frame(wg), "deep", true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelectorAll(".native").length).toBe(1);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    initial.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("nests, in a Svelte wrapper or a plain one", async () => {
    const wg = create(
      framedParagraphs([
        Decoration.Tag.wrapper(Paragraph, FrameWrapper),
        Decoration.Tag.wrapper(Paragraph, Elt.mk("aside", [0])),
      ])
    );
    expect(wg.contentDOM.querySelector("aside > section > section > p")).not.toBeNull();
    // The outer wrappers' components first: the inner ones are drawn when
    // their element is attached.
    expect(enlisted(wg, "frame").map((control) => control.getPos())).toEqual([0, 4, 0, 4]);
    // The inner ones move what they wrap, the outer ones drop their header.
    const change = async (editor: Wordgard) => {
      for (const [i, control] of enlisted(editor, "frame").entries())
        await set(control, i < 2 ? "header" : "deep", i >= 2);
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

  // Svelte attaches the new place before it detaches the old one.
  it("follows a shape it wraps to an earlier place, and makes that place editable", async () => {
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote>",
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, createShape(Quote)),
        Decoration.Tag.wrapper(Blockquote, createWrapper(Moving, { element: "section" })),
      ],
    });
    // The empty `div.a` is chrome, uneditable.
    expect(wg.contentDOM.querySelector(".a")?.getAttribute("contenteditable")).toBe("false");
    await set(find(wg, "moving"), "first", true);
    wg.flush();
    expect(wg.contentDOM.querySelector(".a > blockquote > p")?.textContent).toBe("b");
    expect(wg.contentDOM.querySelector(".a")?.hasAttribute("contenteditable")).toBe(false);
    typeInto(wg, textIn(wg, ".a p"), 1, "y");
    wg.flush();
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe("a|by");
    start.first = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("refuses a Svelte shape as a wrapper and a Svelte wrapper as a shape", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      create(framedParagraphs(Decoration.Tag.wrapper(Paragraph, CalloutShape.of("div"))))
    ).toThrow(/use createWrapper/);
    expect(() =>
      create({
        config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, FrameWrapper)],
      })
    ).toThrow(/use createShape/);
    error.mockRestore();
  });

  it("says when the component doesn't draw what it wraps", () => {
    expect(() =>
      create(
        framedParagraphs(
          Decoration.Tag.wrapper(Paragraph, createWrapper(Bare, { element: "section" }))
        )
      )
    ).toThrow(/A Svelte wrapper's component must draw an element with wrappedDOMRef/);
  });

  it("says when the component's root isn't the wrapper's element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    create(framedParagraphs(Decoration.Tag.wrapper(Paragraph, createWrapper(InlineFrame))));
    expect(error.mock.calls.flat().join("")).toContain(
      "A Svelte wrapper's component drew <span> where its wrapper says <div>"
    );
    error.mockRestore();
  });
});

// An inline atom (a mention-like chip) drawn by a component with chrome of
// its own state, an {#if} in its root, and the component's mounts counted.
const ChipType = Leaf.Type.define<string>("Chip", {
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
const ChipShape = createShape(Chip);

describe("Svelte shapes drawing atoms", () => {
  const chipConfig = [
    basicSchema(),
    GardState.schemaElement.of(ChipType),
    Decoration.Tag.shape(ChipType, ChipShape),
  ];
  const chipDoc = '<p>a<span data-chip="ada"></span>b</p>';
  const chip = (wg: Wordgard) => find(wg, "chip");

  it("draws an inline atom from the node type's element, its chrome uneditable", () => {
    const wg = create({ doc: chipDoc, config: chipConfig });
    const element = wg.contentDOM.querySelector("span[data-chip='ada']");
    expect(element?.textContent).toBe("@ada");
    expect(element?.getAttribute("contenteditable")).toBe("false");
    expect(wg.contentDOM.innerHTML).not.toContain("data-wg-component");
    expect(docTileOf(wg).nodeTile(2)?.dom).toBe(element);
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
  });

  it("keeps the tiles right when an atom's component changes its chrome on its own", async () => {
    const wg = create({ doc: chipDoc, config: chipConfig });
    await set(chip(wg), "open", true);
    expect(wg.contentDOM.querySelector(".card")).not.toBeNull();
    await Promise.resolve();
    start.open = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
    // Closed again: the comment Svelte leaves for the card has a tile, so
    // Wordgard's `sync()` keeps it.
    await set(chip(wg), "open", false);
    typeInto(wg, textIn(wg, "p"), 2, "y");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axyb");
    start.open = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps an atom's component through its selection, the class on its root", () => {
    const wg = create({ doc: chipDoc, config: chipConfig });
    const element = wg.contentDOM.querySelector("span[data-chip]");
    const found = wg.state.doc.nodeAt(2);
    if (!found) throw new Error("No chip");
    wg.dispatch({ selection: GardSelection.node(2, found) });
    wg.flush();
    expect(wg.contentDOM.querySelector("span[data-chip]")).toBe(element);
    expect(element?.classList.contains("wg-selected-node")).toBe(true);
    expect(counted.chipMounts).toBe(1);
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
        Decoration.Tag.shape(Figure, createShape(FigureView)),
        Decoration.Tag.shape(Blockquote, createShape(QuoteAtom).of("div", { atom: true })),
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
    const src = "data:image/svg+xml,";
    const wg = create({
      doc: `<p>a<img src="${src}" alt="A cat">b</p>`,
      config: [basicSchema(), image(), Decoration.Tag.shape(Image, createShape(ImageView))],
    });
    const img = wg.contentDOM.querySelector("img");
    expect(img?.getAttribute("src")).toBe(src);
    expect(img?.getAttribute("alt")).toBe("A cat");
    expect(docTileOf(wg).nodeTile(2)?.dom).toBe(img);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("refuses a content element in an atom", () => {
    expect(() =>
      create({
        doc: chipDoc,
        config: [
          basicSchema(),
          GardState.schemaElement.of(ChipType),
          Decoration.Tag.shape(ChipType, createShape(AtomWithContent)),
        ],
      })
    ).toThrow(/drop its contentDOMRef/);
  });

  it("draws a wrapper around an atom, and an atom from a point shape", async () => {
    const wg = create({
      doc: chipDoc,
      config: [
        ...chipConfig,
        Decoration.Tag.wrapper(ChipType, Elt.mk("span", { class: "w" }, [0])),
      ],
    });
    expect(wg.contentDOM.querySelector(".w > span[data-chip]")?.textContent).toBe("@ada");
    await set(chip(wg), "open", true);
    await Promise.resolve();
    start.open = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
    // A point shape has no type to take attributes from.
    start.open = false;
    const point = create({
      doc: chipDoc,
      config: [
        basicSchema(),
        GardState.schemaElement.of(ChipType),
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.shape(ChipShape.of("span", { atom: true })), 2]])
        ),
      ],
    });
    expect(point.contentDOM.querySelector("p > span:not([data-chip])")?.textContent).toBe("@ada");
    expect(drawn(point)).toEqual(fresh(point));
  });

  // svelteDecorations draws the same heading: this checks nothing is logged.
  it("gives a heading's root its level", () => {
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    const wg = create({
      doc: "<h1>a</h1><h3>b</h3>",
      config: [basicSchema(), Decoration.Tag.shape(Heading, createShape(HeadingView))],
    });
    expect(wg.contentDOM.innerHTML).toBe("<h1>a</h1><h3>b</h3>");
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    expect(drawn(wg)).toEqual(fresh(wg));
    error.mockRestore();
  });
});

// Line numbers beside a paragraph's text: a Svelte shape gives the number
// from its own state through a context, a tag widget at the paragraph's start
// draws it, and the paragraph's content element holds only its text.
const LineNumberType = createWidgetType<null>({ component: LineNumber });

describe("Chrome beside a textblock's text", () => {
  const lineConfig = [
    basicSchema(),
    Decoration.Tag.shape(Paragraph, createShape(LineShape)),
    Decoration.Tag.widget(Paragraph, "start", LineNumberType.of(null)),
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
    await set(find(wg, "line"), "line", 7);
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
    const selection = document.getSelection();
    expect(selection?.anchorNode).toBe(lineText(wg, 1));
    expect(selection?.anchorOffset).toBe(0);
  });
});
