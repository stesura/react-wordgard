// Adapted from react-wordgard's nodeWrapper.browser.test.tsx (by way of vue-wordgard's) for Svelte:
// components around a node's drawing that draw no element, their root a WrappedNode. After each
// change, Wordgard's next flush must find nothing to redraw, and the tiles must be what a fresh
// build over the same DOM gives.
import { tick } from "svelte";
import { Leaf, Node } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, horizontalRule } from "wordgard/schema";
import { GardState } from "wordgard/state";
import { Blockquote, HorizontalRule, Paragraph } from "wordgard/types";

import { drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { nodeWrapper, svelteNodeWrappers } from "../decorations/SvelteNodeWrapper.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import Boxed from "./fixtures/Boxed.svelte";
import LeadWrapper from "./fixtures/LeadWrapper.svelte";
import LetterI from "./fixtures/LetterI.svelte";
import LetterO from "./fixtures/LetterO.svelte";
import LetterP from "./fixtures/LetterP.svelte";
import NotWrapping from "./fixtures/NotWrapping.svelte";
import OrderInner from "./fixtures/OrderInner.svelte";
import OrderOuter from "./fixtures/OrderOuter.svelte";
import Quote from "./fixtures/Quote.svelte";
import RootLead from "./fixtures/RootLead.svelte";
import Rule from "./fixtures/Rule.svelte";
import { controls, initial, reset } from "./fixtures/controls.js";

const doc = "<p>a</p><blockquote><p>bc</p></blockquote>";
const quoteShape = Decoration.Tag.shape(Blockquote, createShape(Quote));
const config = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  quoteShape,
  extra,
];

const editors: SvelteWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  reset();
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

const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

const control = (wg: Wordgard, index = 0) => {
  const found = controls.get(wg)?.[index];
  if (!found) throw new Error("No wrapper drawn");
  return found;
};

// Sets a wrapper's lead and waits for Svelte.
const setLead = async (wg: Wordgard, lead: string | null) => {
  control(wg).set("lead", lead);
  await tick();
};

describe("Node wrappers", () => {
  it("wrap a node's drawing without an element of their own", () => {
    const wg = create({ config: config(nodeWrapper(Blockquote, LeadWrapper)) });
    const plain = create({ config: config() });
    expect(wg.contentDOM.innerHTML).toBe(
      plain.contentDOM.innerHTML.replace("<blockquote>", '<blockquote data-lead="1">')
    );
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("re-render on their own, the node's attributes following, with nothing to redraw", async () => {
    const wg = create({ config: config(nodeWrapper(Blockquote, LeadWrapper)) });
    await setLead(wg, "2");
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-lead")).toBe("2");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    initial.lead = "2";
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("take the user's typing in the node, after re-rendering on their own", async () => {
    const wg = create({ config: config(nodeWrapper(Blockquote, LeadWrapper)) });
    await setLead(wg, null);
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.toString()).toContain("bxc");
    initial.lead = null;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("give the node's position", () => {
    const wg = create({ config: config(nodeWrapper(Blockquote, LeadWrapper)) });
    expect(control(wg).getPos()).toBe(3);
    wg.dispatch({ changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    wg.flush();
    expect(control(wg).getPos()).toBe(8);
  });

  it("nest, the one with the highest precedence outermost", () => {
    const wg = create({
      config: config([
        nodeWrapper(Blockquote, LetterI),
        GardState.prec.high(nodeWrapper(Blockquote, LetterO)),
      ]),
    });
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-lead")).toBe("oi");
  });

  it("wrap a node Wordgard draws, without an element", () => {
    const wg = create({ config: config(nodeWrapper(Paragraph, LeadWrapper)) });
    const plain = create({ config: config() });
    expect(wg.contentDOM.innerHTML).toBe(plain.contentDOM.innerHTML);
    expect(controls.get(wg)?.length).toBe(2);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("give the position of a node a Svelte widget draws", () => {
    const RuleType = createWidgetType<null>({ component: Rule, element: "hr" });
    const wg = create({
      doc: "<p>a</p><hr>",
      config: [
        basicSchema(),
        horizontalRule(),
        Decoration.Tag.shape(HorizontalRule, () => RuleType.of(null)),
        nodeWrapper(HorizontalRule, LeadWrapper),
      ],
    });
    expect(control(wg).getPos()).toBe(3);
  });

  it("draw again when a compartment changes only them, other nodes keeping their elements", () => {
    const wrappers = GardState.Compartment.define();
    const wg = create({ config: config(wrappers.of([])) });
    const paragraph = wg.contentDOM.querySelector("p");
    wg.dispatch({ effects: wrappers.reconfigure(nodeWrapper(Blockquote, LeadWrapper)) });
    wg.flush();
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-lead")).toBe("1");
    expect(wg.contentDOM.querySelector("p")).toBe(paragraph);
    expect(drawn(wg)).toEqual(fresh(wg));
    wg.dispatch({ effects: wrappers.reconfigure([]) });
    wg.flush();
    expect(wg.contentDOM.querySelector("blockquote")?.hasAttribute("data-lead")).toBe(false);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draw an atom again when a compartment gives it a wrapper or takes it away", () => {
    const wrappers = GardState.Compartment.define();
    const wg = create({
      doc: "<p>a</p><hr><p>b</p>",
      config: [basicSchema(), horizontalRule(), wrappers.of([])],
    });
    wg.dispatch({ effects: wrappers.reconfigure(nodeWrapper(HorizontalRule, LeadWrapper)) });
    wg.flush();
    expect(control(wg).getPos()).toBe(3);
    expect(drawn(wg)).toEqual(fresh(wg));
    wg.dispatch({ effects: wrappers.reconfigure([]) });
    wg.flush();
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keep their value when a compartment is given the same wrappers, built again", async () => {
    const wrappers = GardState.Compartment.define();
    const wg = create({ config: config(wrappers.of(nodeWrapper(Blockquote, LeadWrapper))) });
    const quote = wg.contentDOM.querySelector("blockquote");
    const before = wg.state.facet(svelteNodeWrappers.reader);
    await setLead(wg, "2");
    wg.dispatch({ effects: wrappers.reconfigure(nodeWrapper(Blockquote, LeadWrapper)) });
    wg.flush();
    // The same value: no redraw of the whole document.
    expect(wg.state.facet(svelteNodeWrappers.reader)).toBe(before);
    expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
    expect(quote?.getAttribute("data-lead")).toBe("2");
    expect(controls.get(wg)?.length).toBe(1);
  });

  it("wrap every type a function picks, never text", () => {
    const paragraph = Node.Type.get(Paragraph);
    const asked: Node.Type[] = [];
    const wg = create({
      config: config(
        nodeWrapper((type) => {
          asked.push(type);
          return type == paragraph;
        }, LeadWrapper)
      ),
    });
    expect(controls.get(wg)?.length).toBe(2);
    expect(asked).not.toContain(Leaf.Text);
    // Once per type.
    expect(asked.filter((type) => type == paragraph).length).toBe(1);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("give a node Wordgard draws their attributes, not the nodes in its content", () => {
    const wg = create({
      config: [
        basicSchema(),
        blockquote(),
        // The first outermost: the lead's provider, then the attributes from it.
        nodeWrapper(Blockquote, LeadWrapper),
        nodeWrapper(Blockquote, RootLead),
        // Wrapped too, without attributes of its own: it takes none of the quote's.
        nodeWrapper(Paragraph, LetterP),
      ],
    });
    const quote = wg.contentDOM.querySelector("blockquote");
    expect(quote?.getAttribute("data-lead")).toBe("1");
    expect(quote?.className).toBe("led");
    expect(quote?.getAttribute("style")).toBe("padding-top: 1px");
    expect(wg.contentDOM.querySelector("blockquote p")?.hasAttribute("data-lead")).toBe(false);
    expect(wg.contentDOM.querySelector("blockquote p")?.hasAttribute("class")).toBe(false);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("change a drawn node's attributes on their own, with nothing to redraw", async () => {
    const wg = create({
      config: [
        basicSchema(),
        blockquote(),
        nodeWrapper(Blockquote, LeadWrapper),
        nodeWrapper(Blockquote, RootLead),
      ],
    });
    const quote = wg.contentDOM.querySelector("blockquote");
    await setLead(wg, "2");
    expect(quote?.getAttribute("data-lead")).toBe("2");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    await setLead(wg, null);
    expect(quote?.hasAttribute("data-lead")).toBe(false);
    expect(quote?.hasAttribute("style")).toBe(false);
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
    initial.lead = null;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keep a drawn node's own class and style when they drop theirs", async () => {
    const styled = [
      basicSchema(),
      blockquote(),
      Decoration.Tag.attribute(Blockquote, "style", "margin-left: 2px"),
      Decoration.Tag.attribute(Blockquote, "class", "own"),
      nodeWrapper(Blockquote, LeadWrapper),
      nodeWrapper(Blockquote, RootLead),
    ];
    for (const lead of ["1", null]) {
      initial.lead = lead;
      const wg = create({ config: styled });
      const quote = wg.contentDOM.querySelector<HTMLElement>("blockquote");
      await setLead(wg, "2");
      expect(quote?.style.paddingTop).toBe("2px");
      expect(quote?.style.marginLeft).toBe("2px");
      expect(quote?.className).toBe("own led");
      await setLead(wg, null);
      expect(quote?.style.paddingTop).toBe("");
      expect(quote?.style.marginLeft).toBe("2px");
      expect(quote?.className).toBe("own");
      expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
      controls.clear();
    }
  });

  it("give the node their attributes, the outermost winning, their classes joined", () => {
    const order = [
      nodeWrapper(Blockquote, OrderInner),
      GardState.prec.high(nodeWrapper(Blockquote, OrderOuter)),
    ];
    for (const shaped of [false, true]) {
      const wg = create({
        config: [basicSchema(), blockquote(), shaped ? quoteShape : [], order],
      });
      const quote = wg.contentDOM.querySelector("blockquote");
      expect(quote?.getAttribute("data-order")).toBe("outer");
      expect(quote?.className.split(" ").sort()).toEqual(["inner", "kept", "outer"]);
      expect(drawn(wg)).toEqual(fresh(wg));
    }
  });

  it("refuse text", () => {
    expect(() => nodeWrapper(Leaf.Text, LeadWrapper)).toThrow("can't wrap text");
  });

  it("draw every node again when a reconfiguration adds or drops them", () => {
    const wg = create();
    expect(wg.contentDOM.querySelector("blockquote")?.hasAttribute("data-lead")).toBe(false);
    wg.dispatch({
      effects: GardState.reconfigure.of(config(nodeWrapper(Blockquote, LeadWrapper))),
    });
    wg.flush();
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-lead")).toBe("1");
    expect(drawn(wg)).toEqual(fresh(wg));
    wg.dispatch({ effects: GardState.reconfigure.of(config()) });
    wg.flush();
    expect(wg.contentDOM.querySelector("blockquote")?.hasAttribute("data-lead")).toBe(false);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("unmount with the node", () => {
    const wg = create({ config: config(nodeWrapper(Blockquote, LeadWrapper)) });
    wg.dispatch({ changes: { from: 3, to: wg.state.doc.length } });
    wg.flush();
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(() => control(wg).getPos()).toThrow("isn't drawn");
  });

  it("refuse a component without a WrappedNode", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => create({ config: config(nodeWrapper(Blockquote, NotWrapping)) })).toThrow(
      "must draw a WrappedNode"
    );
    spy.mockRestore();
  });

  it("refuse a component drawing an element", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => create({ config: config(nodeWrapper(Blockquote, Boxed)) })).toThrow(
      "node wrapper draws no element"
    );
    spy.mockRestore();
  });
});
