// Adapted from react-wordgard's decorationHooks.browser.test.tsx for Vue: the decoration
// composables. useEditorEventListener's tests wait for it (Phase 4 of the Vue plan), and
// useMergedDOMRefs has no Vue counterpart: Vue's roots take no forwarded ref.
import { defineComponent } from "vue";
import { Elt, Leaf } from "wordgard/doc";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import { GardSelection, GardState } from "wordgard/state";
import { Blockquote, Image, Link } from "wordgard/types";

import { textIn } from "../../../src/testing/editing.js";
import { VueWordgard } from "../VueWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { NodeContent } from "../components/NodeContent.js";
import { WrappedNode } from "../components/WrappedNode.js";
import { createMarkShape } from "../decorations/VueMarkType.js";
import { nodeWrapper } from "../decorations/VueNodeWrapper.js";
import { createShape } from "../decorations/VueShapeType.js";
import { createWidgetType } from "../decorations/VueWidgetType.js";
import { useIgnoreMutation } from "../hooks/useIgnoreMutation.js";
import { useIsNodeSelected } from "../hooks/useIsNodeSelected.js";
import { useNodePos } from "../hooks/useNodePos.js";
import { useSelectNode } from "../hooks/useSelectNode.js";
import { useStopEvent } from "../hooks/useStopEvent.js";

// What the components report and obey, reset after each test.
const seen: { positions: Map<string, () => number>; selections: string[]; stopped: string[] } = {
  positions: new Map(),
  selections: [],
  stopped: [],
};
const obey = { ignore: false, ignoreAll: false };

// A quote: a tool button whose events Wordgard doesn't handle, a label it
// does, the selection as an attribute.
const QuoteView = defineComponent({
  props: ["nodeProps"],
  components: { NodeContent },
  setup() {
    seen.positions.set("quote", useNodePos());
    const selected = useIsNodeSelected();
    useStopEvent((_, event) => event.target instanceof Element && !!event.target.closest(".tool"));
    useIgnoreMutation(() => obey.ignore);
    useSelectNode(
      () => seen.selections.push("select"),
      () => seen.selections.push("deselect")
    );
    return { selected };
  },
  template: `
    <blockquote :data-selected="String(selected)">
      <button class="tool">t</button>
      <span class="label">l</span>
      <NodeContent as="div" class="body" />
    </blockquote>`,
});

const LinkView = defineComponent({
  props: ["markProps"],
  components: { NodeContent },
  setup() {
    seen.positions.set("link", useNodePos());
  },
  template: `<NodeContent as="a" />`,
});

const PictureView = defineComponent({
  setup() {
    useStopEvent(() => true);
    return { selected: useIsNodeSelected() };
  },
  template: `<img alt="" class="picture" :data-selected="String(selected)" />`,
});

// The node's attributes (the selected class) on its root, its mounts counted.
const mounts = { picture: 0 };
const Picture = createWidgetType({
  component: defineComponent({
    props: ["value"],
    components: { PictureView },
    setup() {
      const mount = ++mounts.picture;
      seen.positions.set("picture", useNodePos());
      useIgnoreMutation(() => obey.ignoreAll);
      useSelectNode(
        () => seen.selections.push(`picture select ${mount}`),
        () => seen.selections.push(`picture deselect ${mount}`)
      );
    },
    template: `<span data-frame=""><PictureView /></span>`,
  }),
});

// Components stopping every mousedown: a quote with padding and structure
// around its content element, an inline atom whose chrome is its text.
const stopMousedown = (_: Wordgard, event: Event) => {
  if (event.type != "mousedown") return false;
  if (event.target instanceof Element) seen.stopped.push(`stopped ${event.target.nodeName}`);
  return true;
};

const StopQuote = createShape(
  defineComponent({
    props: ["nodeProps"],
    components: { DecorationRoot, NodeContent },
    setup: () => useStopEvent(stopMousedown),
    template: `
      <DecorationRoot class="stops">
        <div class="frame"><NodeContent as="div" class="body" /></div>
      </DecorationRoot>`,
  })
);

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

const MentionShape = createShape(
  defineComponent({
    props: ["nodeProps"],
    components: { DecorationRoot },
    setup: () => useStopEvent(stopMousedown),
    template: `<DecorationRoot>@{{ nodeProps.node.param }}</DecorationRoot>`,
  })
);

const stopConfig: GardState.Extension = [
  GardState.schemaElement.of(Mention),
  GardState.prec.highest(Decoration.Tag.shape(Blockquote, StopQuote)),
  Decoration.Tag.shape(Mention, MentionShape),
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

const editors: VueWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  seen.positions.clear();
  seen.selections.length = 0;
  seen.stopped.length = 0;
  handled.length = 0;
  Object.assign(obey, { ignore: false, ignoreAll: false });
  mounts.picture = 0;
});

const create = (extra: GardState.Extension = [], source = doc) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = VueWordgard.create({ doc: source, config: [config, extra], parent });
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

describe("Vue decoration composables", () => {
  it("give each decoration's position: a shape's, a mark's, a widget's", () => {
    create();
    const at = (name: string) => seen.positions.get(name)?.();
    expect([at("link"), at("picture"), at("quote")]).toEqual([2, 4, 6]);
  });

  it("stop the events a component says, in its chrome and in a Vue widget", () => {
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
    // An editor inside the Vue widget, as a floating box's sub-editor.
    const inner = VueWordgard.create({
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

  it("are refused outside a Vue decoration, a node wrapper's included", () => {
    const Wrapper = defineComponent({
      props: ["nodeProps"],
      components: { WrappedNode },
      setup: () => {
        useNodePos();
      },
      template: `<WrappedNode />`,
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => create(nodeWrapper(Blockquote, Wrapper))).toThrow(
      "useNodePos is called outside a Vue shape, wrapper, mark or widget"
    );
    error.mockRestore();
  });
});
