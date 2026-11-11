// Node wrappers: components around a node's drawing that render no element. After each change,
// Wordgard's next flush must find nothing to redraw, and the tiles must be what a fresh build over
// the same DOM gives.
import React, { createContext, useContext, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Leaf, Node } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, horizontalRule } from "wordgard/schema";
import { GardState } from "wordgard/state";
import { Blockquote, HorizontalRule, Paragraph } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { NodeRootProps } from "../components/NodeRootProps.js";
import {
  type NodeWrapperComponentProps,
  nodeWrapper,
  nodeWrappers,
} from "../decorations/ReactNodeWrapper.js";
import { type ShapeComponentProps, createShape } from "../decorations/ReactShapeType.js";
import { createWidgetType } from "../decorations/ReactWidgetType.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { drawn, flushKeeps, textIn, typeInto } from "../testing/editing.js";

// What a wrapper hands the shape below: a lead, as a data attribute on the
// shape's root.
const Lead = createContext<string | null>(null);

type Control = { setLead: (lead: string | null) => void; getPos: () => number };
const controls = new Map<Wordgard, Control[]>();
const initial: { lead: string | null } = { lead: "1" };

const LeadWrapper = ({ nodeProps, children }: NodeWrapperComponentProps) => {
  const wg = useWordgard();
  const [lead, setLead] = useState(initial.lead);
  useLayoutEffect(() => {
    const control = {
      setLead: (next: string | null) => flushSync(() => setLead(next)),
      getPos: nodeProps.getPos,
    };
    controls.set(wg, [...(controls.get(wg) ?? []), control]);
  }, [wg, nodeProps.getPos]);
  return <Lead.Provider value={lead}>{children}</Lead.Provider>;
};

// Adds a letter after the lead of the wrappers around it, to show the order.
const letter = (name: string) => {
  const Letter = ({ children }: NodeWrapperComponentProps) => {
    const outer = useContext(Lead);
    return <Lead.Provider value={`${outer ?? ""}${name}`}>{children}</Lead.Provider>;
  };
  return Letter;
};

// Gives the node it wraps, drawn by Wordgard, the lead as its props. Always
// mounted: switching the provider in and out would remount the node.
const RootLead = ({ nodeProps, children }: NodeWrapperComponentProps) => {
  const lead = useContext(Lead);
  return (
    <NodeRootProps
      node={nodeProps.node}
      className={lead == null ? undefined : "led"}
      style={lead == null ? undefined : { paddingTop: `${lead}px` }}
      attributes={lead == null ? undefined : { "data-lead": lead }}
    >
      {children}
    </NodeRootProps>
  );
};

const Quote = ({ children }: ShapeComponentProps) => {
  const lead = useContext(Lead);
  return <DecorationRoot data-lead={lead ?? undefined}>{children}</DecorationRoot>;
};

const doc = "<p>a</p><blockquote><p>bc</p></blockquote>";
const quoteShape = Decoration.Tag.shape(Blockquote, createShape(Quote));
const config = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  quoteShape,
  extra,
];

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  controls.clear();
  initial.lead = "1";
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

const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

const control = (wg: Wordgard, index = 0) => {
  const found = controls.get(wg)?.[index];
  if (!found) throw new Error("No wrapper drawn");
  return found;
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
    control(wg).setLead("2");
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-lead")).toBe("2");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    initial.lead = "2";
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("take the user's typing in the node, after re-rendering on their own", () => {
    const wg = create({ config: config(nodeWrapper(Blockquote, LeadWrapper)) });
    control(wg).setLead(null);
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
        nodeWrapper(Blockquote, letter("i")),
        GardState.prec.high(nodeWrapper(Blockquote, letter("o"))),
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

  it("give the position of a node a React widget draws", () => {
    const Rule = createWidgetType<null>({
      component: () => <DecorationRoot />,
      element: "hr",
    });
    const wg = create({
      doc: "<p>a</p><hr>",
      config: [
        basicSchema(),
        horizontalRule(),
        Decoration.Tag.shape(HorizontalRule, () => Rule.of(null)),
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

  // An atom in the document keeps its view through the reconfiguration, while
  // React draws it anew under its wrapper.
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

  it("keep their value when a compartment is given the same wrappers, built again", () => {
    const wrappers = GardState.Compartment.define();
    const wg = create({ config: config(wrappers.of(nodeWrapper(Blockquote, LeadWrapper))) });
    const quote = wg.contentDOM.querySelector("blockquote");
    const before = wg.state.facet(nodeWrappers.reader);
    control(wg).setLead("2");
    wg.dispatch({ effects: wrappers.reconfigure(nodeWrapper(Blockquote, LeadWrapper)) });
    wg.flush();
    // The same value: no redraw of the whole document (ReactDocTile.updateRanges).
    expect(wg.state.facet(nodeWrappers.reader)).toBe(before);
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

  it("give a node Wordgard draws their props, not the nodes in its content", () => {
    const wg = create({
      config: [
        basicSchema(),
        blockquote(),
        // The first outermost: the lead's provider, then the props from it.
        nodeWrapper(Blockquote, LeadWrapper),
        nodeWrapper(Blockquote, RootLead),
        // Wrapped too, without props of its own: it takes none of the quote's.
        nodeWrapper(Paragraph, letter("p")),
      ],
    });
    const quote = wg.contentDOM.querySelector("blockquote");
    expect(quote?.getAttribute("data-lead")).toBe("1");
    expect(quote?.className).toBe("led");
    expect(quote?.getAttribute("style")).toBe("padding-top: 1px;");
    expect(wg.contentDOM.querySelector("blockquote p")?.hasAttribute("data-lead")).toBe(false);
    expect(wg.contentDOM.querySelector("blockquote p")?.hasAttribute("class")).toBe(false);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("change a drawn node's props on their own, with nothing to redraw", async () => {
    const wg = create({
      config: [
        basicSchema(),
        blockquote(),
        nodeWrapper(Blockquote, LeadWrapper),
        nodeWrapper(Blockquote, RootLead),
      ],
    });
    const quote = wg.contentDOM.querySelector("blockquote");
    control(wg).setLead("2");
    expect(quote?.getAttribute("data-lead")).toBe("2");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    control(wg).setLead(null);
    expect(quote?.hasAttribute("data-lead")).toBe(false);
    // React empties a style it drops rather than removing the attribute.
    expect(quote?.getAttribute("style") ?? "").toBe("");
    await Promise.resolve();
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
    initial.lead = null;
    // But for that empty style, as a fresh build draws it.
    const now = drawn(wg);
    expect({ ...now, html: now.html.replace(' style=""', "") }).toEqual(fresh(wg));
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
});
