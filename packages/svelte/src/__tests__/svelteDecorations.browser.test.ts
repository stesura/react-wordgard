// Adapted from react-wordgard's reactShape and reactMark browser tests (by way of vue-wordgard's)
// for Svelte: Svelte shapes, wrappers, marks and widgets, written as users write them. After each
// change, Wordgard's next flush must find nothing to redraw, and the tiles must be what a fresh
// editor builds.
import { mount, unmount } from "svelte";
import { Leaf } from "wordgard/doc";
import { Decoration, Widget, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote, Heading, Image, Link, Paragraph } from "wordgard/types";

import { tick } from "../testing/tick.js";
import { composeIn, drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { createMarkShape } from "../decorations/SvelteMarkType.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import { createWrapper } from "../decorations/SvelteWrapperType.js";
import Badge from "./fixtures/Badge.svelte";
import Callout from "./fixtures/Callout.svelte";
import { box } from "../helpers/box.svelte.js";
import Focuser from "./fixtures/Focuser.svelte";
import Frame from "./fixtures/Frame.svelte";
import HeadingView from "./fixtures/Heading.svelte";
import HeadingRoot from "./fixtures/HeadingRoot.svelte";
import Labelled from "./fixtures/Labelled.svelte";
import LinkMark from "./fixtures/LinkMark.svelte";
import Measurer from "./fixtures/Measurer.svelte";
import Thrower from "./fixtures/Thrower.svelte";
import { alive, controls, initial, reset } from "./fixtures/controls.js";

const CalloutShape = createShape(Callout);
const BadgeType = createWidgetType<string>({ component: Badge, element: "button" });

const doc = "<p>a</p><blockquote><p>bc</p></blockquote>";
const config = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, CalloutShape.of("div")),
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

const control = (wg: Wordgard, index = 0) => {
  const found = controls.get(wg)?.[index];
  if (!found) throw new Error("No component drawn");
  return found;
};

// Sets a component's state and waits for Svelte, then for Wordgard's DOM
// observer.
const set = async (wg: Wordgard, name: string, value: unknown, index = 0) => {
  control(wg, index).set(name, value);
  await tick();
  await Promise.resolve();
};

// What a fresh editor draws for the same state, its components starting as
// `wg`'s are.
const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

// Svelte's anchors in the document outside chrome: a comment, or an empty
// text node, in a content element or among the document's nodes.
const anchorsIn = (wg: Wordgard) => {
  const found: string[] = [];
  const walk = (element: Element) => {
    for (const child of element.childNodes) {
      const tile = child.wgTile;
      if (child instanceof Comment || (child instanceof Text && !child.length))
        if (!tile) found.push(`${element.localName} > ${child.nodeName}`);
      if (child instanceof Element) walk(child);
    }
  };
  walk(wg.contentDOM);
  return found;
};

describe("Svelte shapes", () => {
  it("draws the component, with the content in its content element", () => {
    const wg = create();
    const html = wg.contentDOM.innerHTML;
    expect(html).toContain('<div class="body"><p>bc</p></div>');
    expect(html).not.toContain("data-wg-component");
    expect(wg.contentDOM.querySelector(".bar")?.getAttribute("contenteditable")).toBe("false");
    expect(anchorsIn(wg)).toEqual([]);
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
    await set(wg, "bar", false);
    expect(wg.contentDOM.querySelector(".bar")).toBeNull();
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    initial.bar = true;
    expect(flushKeeps(wg)).toBe(true);
    await set(wg, "bar", true);
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the attributes the component sets on its own", async () => {
    const wg = create();
    await set(wg, "label", "b");
    expect(wg.contentDOM.querySelector("[data-label]")?.getAttribute("data-label")).toBe("b");
    expect(flushKeeps(wg)).toBe(true);
  });

  it("takes the user's typing in its content, with the chrome changing before the flush", async () => {
    const wg = create();
    typeInto(wg, textIn(wg, ".body p"), 1, "x");
    control(wg).set("bar", false);
    await tick();
    wg.flush();
    expect(wg.state.doc.toString()).toContain("bxc");
    expect(wg.contentDOM.querySelector(".body p")?.textContent).toBe("bxc");
    initial.bar = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps a composition in its content", () => {
    const wg = create();
    const text = textIn(wg, ".body p");
    const composition = composeIn(wg, text);
    composition.update(1, "x");
    wg.flush();
    expect(textIn(wg, ".body p")).toBe(text);
    composition.update(2, "y");
    composition.end();
    wg.flush();
    expect(wg.state.doc.toString()).toContain("bxyc");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows content the component moves to another element, its DOM kept", async () => {
    const wg = create();
    const paragraph = wg.contentDOM.querySelector(".body p");
    await set(wg, "deep", true);
    expect(wg.contentDOM.querySelector(".deep b p")).toBe(paragraph);
    wg.flush();
    initial.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    initial.deep = false;
    typeInto(wg, textIn(wg, ".deep b p"), 0, "x");
    wg.flush();
    expect(wg.state.doc.toString()).toContain("xbc");
  });

  it("unmounts its components, nested ones included, when the node goes", () => {
    const wg = create({
      doc: "<p>a</p><blockquote><blockquote><p>bc</p></blockquote></blockquote>",
      config: config(
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.widget(BadgeType.of("!")), 5]])
        )
      ),
    });
    expect(alive.get("callout")).toBe(2);
    expect(alive.get("badge")).toBe(1);
    wg.dispatch({ changes: { from: 3, to: wg.state.doc.length } });
    wg.flush();
    expect(alive.get("callout")).toBe(0);
    expect(alive.get("badge")).toBe(0);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("gives what its content draws the component's contexts", () => {
    const wg = create({
      config: config([
        Decoration.Point.source.of(() =>
          Decoration.Point.set([
            [Decoration.Point.widget(BadgeType.of("out")), 1],
            [Decoration.Point.widget(BadgeType.of("in")), 5],
          ])
        ),
      ]),
    });
    const tones = [...wg.contentDOM.querySelectorAll(".badge")].map((badge) => [
      badge.textContent,
      badge.getAttribute("data-tone"),
    ]);
    expect(tones).toEqual([
      ["out0", "none"],
      ["in0", "warm"],
    ]);
  });

  it("draws the document again after a component threw in an update", () => {
    const wg = create({
      doc: "<p>a</p><blockquote><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Thrower))],
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    initial.fail = true;
    wg.dispatch({ changes: { from: 5, insert: [Leaf.text("x")] } });
    expect(() => wg.flush()).toThrow("Thrower");
    initial.fail = false;
    wg.dispatch({ changes: { from: 5, insert: [Leaf.text("y")] } });
    wg.flush();
    spy.mockRestore();
    expect(wg.contentDOM.querySelector("[data-state]")?.textContent).toBe("yxb");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("refuses a flush from inside a component's effect, and draws on the next one", async () => {
    const wg = create({
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, createShape(Measurer)),
      ],
    });
    wg.dispatch({ changes: { from: 5, insert: [Leaf.text("x")] } });
    control(wg).set("measure", true);
    await tick();
    const shape = wg.contentDOM.querySelector("[data-refused]");
    expect(shape?.getAttribute("data-refused")).toContain(
      "can't update from inside a Svelte effect"
    );
    expect(shape?.textContent).toBe("bc");
    wg.flush();
    expect(shape?.textContent).toBe("xbc");
  });

  it("draws nothing for a nested node a native widget now draws, before its list drops it", () => {
    const Native = Widget.define<null>({ render: () => document.createElement("hr") });
    let native = false;
    const wg = create({
      doc: '<p>a<img src="x.png">b</p>',
      config: [
        basicSchema(),
        image(),
        Decoration.Point.source.of(() =>
          Decoration.Point.set(native ? [[Decoration.Point.shape(Native.of(null)), 2]] : [])
        ),
      ],
    });
    native = true;
    wg.dispatch({});
    expect(() => wg.flush()).not.toThrow();
    expect(wg.contentDOM.querySelector("p hr")).toBeTruthy();
    expect(wg.contentDOM.querySelector("img:not(.wg-buffer)")).toBeNull();
  });

  it("follows a replaced root that holds the content", () => {
    const wg = create({
      doc: "<h1>a</h1><p>b</p>",
      config: [basicSchema(), Decoration.Tag.shape(Heading, createShape(HeadingRoot))],
    });
    expect(wg.contentDOM.innerHTML).toBe("<h1>a</h1><p>b</p>");
    wg.dispatch({ changes: { from: 0, to: 1, insert: [Heading.of(2)] } });
    wg.flush();
    expect(wg.contentDOM.innerHTML).toBe("<h2>a</h2><p>b</p>");
    wg.dispatch({ changes: { from: 2, insert: [Leaf.text("x")] } });
    wg.flush();
    expect(wg.contentDOM.innerHTML).toBe("<h2>ax</h2><p>b</p>");
  });

  // Its content is drawn outside the component's effects, later: the editor read from an effect
  // in the same Svelte flush waits for it.
  it("lets an effect read the editor while a shape moves its content", async () => {
    const wg = create();
    const on = box(false);
    const app = mount(Focuser, { target: document.createElement("div"), props: { wg, on } });
    control(wg).set("deep", true);
    on.current = true;
    await tick();
    await Promise.resolve();
    void unmount(app);
    wg.flush();
    initial.deep = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, ".deep b p"), 0, "x");
    wg.flush();
    expect(wg.state.doc.toString()).toContain("xbc");
  });

  it("draws the rest, then the document anew, when one content element is wrong", () => {
    const wg = create({
      doc: "<p>a</p>",
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, CalloutShape.of("div")),
        Decoration.Tag.shape(Heading, createShape(Labelled)),
      ],
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    wg.dispatch({
      changes: {
        from: 3,
        insert: [
          Blockquote.create([Paragraph.create([Leaf.text("x")])]),
          Heading.of(1).create([Leaf.text("y")]),
          Blockquote.create([Paragraph.create([Leaf.text("z")])]),
        ],
      },
    });
    expect(() => wg.flush()).toThrow("content element is drawn empty");
    expect([...wg.contentDOM.querySelectorAll(".body")].map((body) => body.textContent)).toEqual([
      "x",
      "z",
    ]);
    const heading = wg.state.doc.content.findIndex((node) => node.name == "Heading");
    let from = 0;
    for (const node of wg.state.doc.content.slice(0, heading)) from += node.length;
    wg.dispatch({ changes: { from, to: from + (wg.state.doc.content[heading]?.length ?? 0) } });
    wg.flush();
    spy.mockRestore();
    expect(wg.contentDOM.querySelector(".label")).toBeNull();
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("refuses chrome in a root that holds the content", () => {
    expect(() =>
      create({
        doc: "<blockquote><p>a</p></blockquote>",
        config: [
          basicSchema(),
          blockquote(),
          Decoration.Tag.shape(Blockquote, createShape(Labelled)),
        ],
      })
    ).toThrow("content element is drawn empty");
  });

  it("draws a root of the node's own tag with DecorationRoot, and follows its level", () => {
    const wg = create({
      doc: "<h1>a</h1><p>b</p>",
      config: [basicSchema(), Decoration.Tag.shape(Heading, createShape(HeadingView))],
    });
    const text = textIn(wg, "h1");
    expect(wg.contentDOM.innerHTML).toBe("<h1>a</h1><p>b</p>");
    wg.dispatch({ changes: { from: 0, to: 1, insert: [Heading.of(2)] } });
    wg.flush();
    expect(wg.contentDOM.innerHTML).toBe("<h2>a</h2><p>b</p>");
    expect(textIn(wg, "h2")).toBe(text);
    expect(anchorsIn(wg)).toEqual([]);
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});

describe("Svelte wrappers", () => {
  const framed = () =>
    create({
      doc: "<p>a</p><p>b</p>",
      config: [
        basicSchema(),
        Decoration.Tag.wrapper(Paragraph, createWrapper(Frame, { element: "section" })),
      ],
    });

  it("draws the component around the node, its chrome uneditable", () => {
    const wg = framed();
    const section = wg.contentDOM.querySelector("section");
    expect(section?.firstElementChild?.localName).toBe("p");
    expect(section?.querySelector("header")?.getAttribute("contenteditable")).toBe("false");
    expect(control(wg).getPos()).toBe(0);
    expect(control(wg, 1).getPos()).toBe(3);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the tiles right when the component changes its chrome on its own", async () => {
    const wg = framed();
    await set(wg, "header", false);
    expect(wg.contentDOM.querySelectorAll("header").length).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "section p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.toString()).toContain("ax");
  });
});

describe("Svelte wrappers around Svelte shapes", () => {
  it("keeps what it wraps first when the shape's root is replaced", () => {
    const wg = create({
      doc: "<h1>a</h1>",
      config: [
        basicSchema(),
        Decoration.Tag.shape(Heading, createShape(HeadingView)),
        Decoration.Tag.wrapper(Heading, createWrapper(Frame, { element: "section" })),
      ],
    });
    expect(wg.contentDOM.querySelector("section")?.firstElementChild?.localName).toBe("h1");
    wg.dispatch({ changes: { from: 0, to: 1, insert: [Heading.of(2)] } });
    wg.flush();
    expect(wg.contentDOM.querySelector("section")?.firstElementChild?.localName).toBe("h2");
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});

describe("Svelte marks", () => {
  const linked = () =>
    create({
      doc: '<p>a<a href="https://x/">bc</a>d</p>',
      config: [
        basicSchema(),
        Decoration.Mark.shape(Link, createMarkShape(LinkMark, { element: "a" })),
      ],
    });

  it("draws the component with the content in its content element", () => {
    const wg = linked();
    expect(wg.contentDOM.innerHTML).toBe(
      '<p>a<a href="https://x/" title="a"><i class="icon" contenteditable="false">^</i><span class="text">bc</span></a>d</p>'
    );
    expect(control(wg).getPos()).toBe(2);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps a composition inside the mark", () => {
    const wg = linked();
    const text = textIn(wg, ".text");
    const composition = composeIn(wg, text);
    composition.update(1, "x");
    wg.flush();
    composition.update(2, "y");
    composition.end();
    wg.flush();
    expect(textIn(wg, ".text").data).toBe("bxyc");
    expect(wg.state.doc.toString()).toContain("bxyc");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the attributes it sets on its own", async () => {
    const wg = linked();
    await set(wg, "title", "b");
    expect(wg.contentDOM.querySelector("a")?.title).toBe("b");
    expect(flushKeeps(wg)).toBe(true);
  });
});

describe("Svelte widgets", () => {
  it("draws the component, its events reaching it", () => {
    const wg = create({
      doc: "<p>ab</p>",
      config: [
        basicSchema(),
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.widget(BadgeType.of("w")), 2]])
        ),
      ],
    });
    const badge = wg.contentDOM.querySelector<HTMLElement>(".badge");
    expect(badge?.textContent).toBe("w0");
    badge?.click();
    return tick().then(() => {
      expect(badge?.textContent).toBe("w1");
      expect(flushKeeps(wg)).toBe(true);
    });
  });

  it("draws a node with a widget", () => {
    const Picture = createWidgetType<string>({ component: Badge });
    const wg = create({
      doc: '<p>a<img src="x.png">b</p>',
      config: [
        basicSchema(),
        image(),
        Decoration.Tag.shape(Image, (tag) => Picture.of(String(tag.param))),
      ],
    });
    expect(wg.contentDOM.querySelector(".badge")?.textContent).toContain("x.png");
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});
