// The hooks React decorations use,
// react-prosemirror's node view hooks for Wordgard: positions, stopped events,
// claimed mutations, the node selection, editor event listeners before
// keymaps, merged refs.
import React, { forwardRef, useRef, useState } from "react";
import { Elt } from "wordgard/doc";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import { GardSelection, GardState } from "wordgard/state";
import { Blockquote, Image, Link } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { type MarkComponentProps, createMarkShape } from "../decorations/ReactMarkType.js";
import { type ShapeComponentProps, createShape } from "../decorations/ReactShapeType.js";
import { type WidgetComponentProps, createWidgetType } from "../decorations/ReactWidgetType.js";
import { useEditorEventListener } from "../hooks/useEditorEventListener.js";
import { useIgnoreMutation } from "../hooks/useIgnoreMutation.js";
import { useIsNodeSelected } from "../hooks/useIsNodeSelected.js";
import { useMergedDOMRefs } from "../hooks/useMergedDOMRefs.js";
import { useNodePos } from "../hooks/useNodePos.js";
import { useSelectNode } from "../hooks/useSelectNode.js";
import { useStopEvent } from "../hooks/useStopEvent.js";
import { textIn } from "../testing/editing.js";

// What the components report and obey, reset after each test.
const seen: {
  positions: Map<string, () => number>;
  roots: Map<string, Element | null>;
  selections: string[];
  listened: string[];
} = { positions: new Map(), roots: new Map(), selections: [], listened: [] };
const obey = { ignore: false, handle: false, ignoreAll: false };

const PositionOf = ({ name }: { name: string }) => {
  seen.positions.set(name, useNodePos());
  return null;
};

// A quote: a tool button whose events Wordgard doesn't handle, a label it
// does, the selection as an attribute, two keydown listeners.
const QuoteView = forwardRef<HTMLQuoteElement, ShapeComponentProps<HTMLQuoteElement>>(
  ({ nodeProps: { contentDOMRef }, children, ...attrs }, ref) => {
    const selected = useIsNodeSelected();
    useStopEvent((_, event) => event.target instanceof Element && !!event.target.closest(".tool"));
    useIgnoreMutation(() => obey.ignore);
    useSelectNode(
      () => seen.selections.push("select"),
      () => seen.selections.push("deselect")
    );
    useEditorEventListener("keydown", (wg, event) => {
      seen.listened.push(`first ${event.key} ${wg instanceof Wordgard}`);
      return obey.handle;
    });
    useEditorEventListener("keydown", (_, event) => {
      seen.listened.push(`second ${event.key}`);
    });
    return (
      <blockquote {...attrs} ref={ref} data-selected={String(selected)}>
        <PositionOf name="quote" />
        <button className="tool">t</button>
        <span className="label">l</span>
        <div className="body" ref={contentDOMRef}>
          {children}
        </div>
      </blockquote>
    );
  }
);

// A link, its root in an object ref and a callback too.
const LinkView = forwardRef<HTMLAnchorElement, MarkComponentProps<HTMLAnchorElement>>(
  ({ children }, ref) => {
    const root = useRef<HTMLAnchorElement | null>(null);
    // The callback, last, sees the object ref set.
    const merged = useMergedDOMRefs(ref, root, (dom: HTMLAnchorElement | null) => {
      seen.roots.set("callback", dom);
      seen.roots.set("object", root.current);
    });
    return (
      <a ref={merged}>
        <PositionOf name="link" />
        {children}
      </a>
    );
  }
);

const PictureView = forwardRef<HTMLImageElement, WidgetComponentProps<null>>((_, ref) => {
  useStopEvent(() => true);
  const selected = useIsNodeSelected();
  return <img ref={ref} alt="" className="picture" data-selected={String(selected)} />;
});

// The node's attributes (the selected class) on its root, its mounts counted.
const mounts = { picture: 0 };
const Picture = createWidgetType({
  component: forwardRef<HTMLSpanElement, WidgetComponentProps<null>>(({ value, ...attrs }, ref) => {
    useIgnoreMutation(() => obey.ignoreAll);
    useSelectNode(
      () => seen.selections.push(`picture select ${mount}`),
      () => seen.selections.push(`picture deselect ${mount}`)
    );
    const [mount] = useState(() => ++mounts.picture);
    return (
      <span {...attrs} ref={ref} data-frame="">
        <PositionOf name="picture" />
        <PictureView value={value} />
      </span>
    );
  }),
});

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
  Decoration.Tag.shape(Blockquote, createShape({ component: QuoteView, element: "blockquote" })),
  Decoration.Tag.shape(Image, Picture.of(null)),
  Decoration.Mark.shape(Link, createMarkShape({ component: LinkView, element: "a" })),
  recordHandled,
];

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  seen.positions.clear();
  seen.roots.clear();
  seen.selections.length = 0;
  seen.listened.length = 0;
  handled.length = 0;
  Object.assign(obey, { ignore: false, handle: false, ignoreAll: false });
  mounts.picture = 0;
});

const create = (extra: GardState.Extension = []) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = ReactWordgard.create({ doc, config: [config, extra], parent });
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

describe("React decoration hooks", () => {
  it("give each decoration's position: a shape's, a mark's, a widget's", () => {
    create();
    const at = (name: string) => seen.positions.get(name)?.();
    expect([at("link"), at("picture"), at("quote")]).toEqual([2, 4, 6]);
  });

  it("merge the refs a component gives its root", () => {
    const wg = create();
    const link = wg.contentDOM.querySelector("a");
    expect([seen.roots.get("callback"), seen.roots.get("object")]).toEqual([link, link]);
    expect(seen.positions.get("link")?.()).toBe(2);
  });

  it("stop the events a component says, in its chrome and in a React widget", () => {
    const wg = create();
    fire(wg.contentDOM.querySelector(".tool"), mousedown());
    fire(wg.contentDOM.querySelector(".label"), mousedown());
    fire(wg.contentDOM.querySelector(".picture"), mousedown());
    expect(handled).toEqual(["mousedown label"]);
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
    const quote = () => wg.contentDOM.querySelector("blockquote");
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
    // One flush's effects, in React's order.
    expect([...seen.selections].sort()).toEqual(["deselect", "picture select 1", "select"]);
  });

  it("keep a widget-drawn node's component through its selection, the class as a prop", () => {
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
    // An editor inside the React widget, as a floating box's sub-editor.
    const inner = ReactWordgard.create({
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
    // With a plugin added: Wordgard redoes its handlers when its plugins change.
    const plugin = Wordgard.Plugin.define(() => ({}));
    wg.dispatch({ effects: GardState.reconfigure.of([config, plugin]) });
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
});
