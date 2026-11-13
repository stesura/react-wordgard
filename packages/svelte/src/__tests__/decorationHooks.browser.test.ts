// Adapted from vue-wordgard's decorationHooks.browser.test.ts (itself from react-wordgard's) for
// Svelte: the decoration hooks, and useEditorEventListener in a decoration, in components written
// as users write them (fixtures/hooks/).
import { Elt, Leaf } from "wordgard/doc";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import { GardSelection, GardState } from "wordgard/state";
import { Blockquote, Image, Link } from "wordgard/types";

import { textIn } from "../../../../test/editing.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { createMarkShape } from "../decorations/SvelteMarkType.js";
import { nodeWrapper } from "../decorations/SvelteNodeWrapper.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import LinkView from "./fixtures/hooks/LinkView.svelte";
import MentionShape from "./fixtures/hooks/MentionShape.svelte";
import PictureComponent from "./fixtures/hooks/Picture.svelte";
import PosWrapper from "./fixtures/hooks/PosWrapper.svelte";
import QuoteView from "./fixtures/hooks/QuoteView.svelte";
import StopQuote from "./fixtures/hooks/StopQuote.svelte";
import { mounts, obey, resetProbes, seen } from "./fixtures/hooks/probes.js";

const Picture = createWidgetType<null>({ component: PictureComponent });

const Mention = Leaf.Type.define<string>("Mention", {
  inline: true,
  validate: "string",
  shape: {
    element: "span",
    attributes: { class: "mention" },
    selector: "span.mention",
    readElement: (elt) => elt.textContent ?? "",
  },
});

const stopConfig: GardState.Extension = [
  GardState.schemaElement.of(Mention),
  GardState.prec.highest(Decoration.Tag.shape(Blockquote, createShape(StopQuote))),
  Decoration.Tag.shape(Mention, createShape(MentionShape)),
];

// The events Wordgard's own handlers get, as a keymap would.
const handled: string[] = [];
const recordHandled = [
  Wordgard.domEventHandler("mousedown", (event) => {
    if (event.target instanceof Element) handled.push(`mousedown ${event.target.className}`);
  }),
  Wordgard.domEventHandler("keydown", (event) => {
    handled.push(`keydown ${event.key}`);
  }),
];

const doc = '<p>a<a href="x">bc</a><img src="data:,"></p><blockquote><p>d</p></blockquote>';
const config: GardState.Extension = [
  basicSchema(),
  blockquote(),
  image(),
  Decoration.Tag.shape(Blockquote, createShape(QuoteView)),
  Decoration.Tag.shape(Image, Picture.of(null)),
  Decoration.Mark.shape(Link, createMarkShape(LinkView, { element: "a" })),
  recordHandled,
];

const editors: SvelteWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  handled.length = 0;
  resetProbes();
});

const create = (extra: GardState.Extension = [], source = doc) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = SvelteWordgard.create({ doc: source, config: [config, extra], parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const fire = (dom: Element | null | undefined, event: Event) => {
  if (!dom) throw new Error("Nothing to fire at");
  dom.dispatchEvent(event);
  return event;
};

const mousedown = () => new MouseEvent("mousedown", { bubbles: true, cancelable: true });

const keydown = (key: string) =>
  new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });

describe("Svelte decoration hooks", () => {
  it("give each decoration's position: a shape's, a mark's, a widget's", () => {
    create();
    const at = (name: string) => seen.positions.get(name)?.();
    expect([at("link"), at("picture"), at("quote")]).toEqual([2, 4, 6]);
  });

  it("stop the events a component says, in its chrome and in a Svelte widget", () => {
    const wg = create();
    fire(wg.contentDOM.querySelector(".tool"), mousedown());
    fire(wg.contentDOM.querySelector(".label"), mousedown());
    fire(wg.contentDOM.querySelector(".picture"), mousedown());
    expect(handled).toEqual(["mousedown label"]);
  });

  it("stop the events a component says on its own elements, not in its content", () => {
    const wg = create(
      stopConfig,
      '<p>a<span class="mention">ada</span></p><blockquote><p>d</p></blockquote>'
    );
    const quote = wg.contentDOM.querySelector("blockquote.stops");
    fire(quote, mousedown());
    fire(quote?.querySelector(".frame"), mousedown());
    fire(wg.contentDOM.querySelector(".mention"), mousedown());
    expect(handled).toEqual([]);
    expect(seen.stopped).toEqual(["stopped BLOCKQUOTE", "stopped DIV", "stopped SPAN"]);
    // The content element and what it holds are Wordgard's.
    fire(quote?.querySelector(".body"), mousedown());
    fire(quote?.querySelector("p"), mousedown());
    expect(handled).toEqual(["mousedown body", "mousedown "]);
    expect(seen.stopped).toHaveLength(3);
    wg.focus();
    expect(wg.hasFocus).toBe(true);
    fire(textIn(wg, "blockquote p").parentElement, keydown("x"));
    expect(handled).toContain("keydown x");
  });

  it("leave Wordgard the mutations a component doesn't claim, and not those it does", async () => {
    const wg = create();
    textIn(wg, ".body p").insertData(1, "x");
    await Promise.resolve();
    wg.flush();
    // Wordgard puts back what the document says.
    expect(textIn(wg, ".body p").data).toBe("d");
    obey.ignore = true;
    textIn(wg, ".body p").insertData(1, "x");
    await Promise.resolve();
    wg.flush();
    expect(textIn(wg, ".body p").data).toBe("dx");
  });

  it("tell a component when its node is selected, and run its callbacks", () => {
    const wg = create();
    const quote = () => wg.contentDOM.querySelector<HTMLElement>("blockquote");
    expect(quote()?.dataset["selected"]).toBe("false");
    const node = (pos: number) => {
      const found = wg.state.doc.nodeAt(pos);
      if (!found) throw new Error(`No node at ${pos}`);
      return GardSelection.node(pos, found);
    };
    wg.dispatch({ selection: node(6) });
    wg.flush();
    expect(quote()?.dataset["selected"]).toBe("true");
    expect(seen.selections).toEqual(["select"]);
    wg.dispatch({ selection: node(4) });
    wg.flush();
    expect(quote()?.dataset["selected"]).toBe("false");
    expect(wg.contentDOM.querySelector<HTMLElement>(".picture")?.dataset["selected"]).toBe("true");
    expect([...seen.selections].sort()).toEqual(["deselect", "picture select 1", "select"]);
  });

  it("keep a widget-drawn node's component through its selection, the class on its root", () => {
    const wg = create();
    const picture = () => wg.contentDOM.querySelector("[data-frame]");
    const before = picture();
    const found = wg.state.doc.nodeAt(4);
    if (!found) throw new Error("No picture");
    wg.dispatch({ selection: GardSelection.node(4, found) });
    wg.flush();
    expect(picture()).toBe(before);
    expect(picture()?.className).toBe("wg-selected-node");
    expect(picture()?.parentElement?.nodeName).toBe("P");
    wg.dispatch({ selection: { anchor: 1 } });
    wg.flush();
    expect(picture()).toBe(before);
    expect(picture()?.className).toBe("");
    expect(seen.selections).toEqual(["picture select 1", "picture deselect 1"]);
    expect(mounts.picture).toBe(1);
  });

  it("tell a component its node is selected when a wrapper sits around it", () => {
    const frame = Decoration.Point.source.of(() =>
      Decoration.Point.set([[Decoration.Point.wrapper(Elt.mk("div", { class: "frame" }, [0])), 6]])
    );
    const wg = create(frame);
    const found = wg.state.doc.nodeAt(6);
    if (!found) throw new Error("No quote");
    wg.dispatch({ selection: GardSelection.node(6, found) });
    wg.flush();
    expect(
      wg.contentDOM.querySelector("div.frame > blockquote")?.getAttribute("data-selected")
    ).toBe("true");
  });

  it("keep a decoration's handlers to its own editor", async () => {
    const wg = create();
    obey.ignoreAll = true;
    // An editor inside the Svelte widget, as a floating box's sub-editor.
    const inner = SvelteWordgard.create({
      doc: "<p>z</p>",
      config: basicSchema(),
      parent: wg.contentDOM.querySelector("[data-frame]") ?? undefined,
    });
    inner.flush();
    editors.push(inner);
    textIn(inner, "p").insertData(1, "x");
    await Promise.resolve();
    inner.flush();
    expect(textIn(inner, "p").data).toBe("z");
  });

  it("keep listening after the state is reconfigured", () => {
    const wg = create();
    wg.dispatch({ effects: GardState.reconfigure.of(config) });
    wg.flush();
    // The handlers come back with a transaction of their own.
    wg.flush();
    fire(wg.contentDOM, keydown("q"));
    expect(seen.listened).toEqual(["second q", "first q true"]);
  });

  it("run editor event listeners before Wordgard's handlers, the latest first", () => {
    const wg = create();
    const event = fire(wg.contentDOM, keydown("q"));
    expect(seen.listened).toEqual(["second q", "first q true"]);
    expect(handled).toEqual(["keydown q"]);
    expect(event.defaultPrevented).toBe(false);
    obey.handle = true;
    const stopped = fire(wg.contentDOM, keydown("w"));
    expect(handled).toEqual(["keydown q"]);
    expect(stopped.defaultPrevented).toBe(true);
  });

  it("drop a component's listeners when it unmounts", () => {
    const wg = create();
    wg.dispatch({ changes: { from: 6, to: wg.state.doc.length } });
    wg.flush();
    expect(wg.contentDOM.querySelector("blockquote")).toBeNull();
    fire(wg.contentDOM, keydown("q"));
    expect(seen.listened).toEqual([]);
    expect(handled).toEqual(["keydown q"]);
  });

  // A component throwing as it's set up draws nothing, and Svelte's boundary reports the error
  // a microtask later: the commit throws first, saying so.
  it("are refused outside a Svelte decoration, a node wrapper's included", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => create(nodeWrapper(Blockquote, PosWrapper))).toThrow("must draw a WrappedNode");
    await Promise.resolve();
    expect(String(error.mock.calls[0]?.[0])).toContain(
      "useNodePos is called outside a Svelte shape, wrapper, mark or widget"
    );
    error.mockRestore();
  });
});
