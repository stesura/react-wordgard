// Adapted from vue-wordgard's decorationRoot.browser.test.ts for Svelte. Wordgard's attributes
// reach the root only through the spread: the component merges its own with them as it likes.
import { mount, tick, unmount } from "svelte";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, horizontalRule, image } from "wordgard/schema";
import { GardSelection, type GardState } from "wordgard/state";
import { Blockquote, Heading, HorizontalRule, Image, Link, Paragraph } from "wordgard/types";

import { drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import DecorationRoot from "../components/DecorationRoot.svelte";
import { createMarkShape } from "../decorations/SvelteMarkType.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import { createWrapper } from "../decorations/SvelteWrapperType.js";
import { controls, reset } from "./fixtures/controls.js";
import BadgeView from "./fixtures/mark/Badge.svelte";
import Counted from "./fixtures/mark/Counted.svelte";
import FrameRoot from "./fixtures/mark/FrameRoot.svelte";
import IconView from "./fixtures/mark/Icon.svelte";
import LinkRoot from "./fixtures/mark/LinkRoot.svelte";
import Listed from "./fixtures/mark/Listed.svelte";
import Plain from "./fixtures/mark/Plain.svelte";
import Quote from "./fixtures/mark/Quote.svelte";
import Root from "./fixtures/mark/Root.svelte";
import TagView from "./fixtures/mark/Tag.svelte";
import Tinted from "./fixtures/mark/Tinted.svelte";
import { counts, resetMarks } from "./fixtures/mark/state.js";

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  reset();
  resetMarks();
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension }) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? SvelteWordgard.create({ state: spec.state, parent })
    : SvelteWordgard.create({ doc: spec.doc ?? "", config: spec.config ?? [], parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

// Sets a component's state and waits for Svelte, then for Wordgard's DOM
// observer.
const set = async (wg: Wordgard, name: string, value: unknown) => {
  const found = controls.get(wg)?.[0];
  if (!found) throw new Error("No component drawn");
  found.set(name, value);
  await tick();
  await Promise.resolve();
};

const quoteConfig = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, createShape(Quote)),
  extra,
];

describe("The factories", () => {
  it("give the same value for the same component", () => {
    expect(createShape(Plain)).toBe(createShape(Plain));
    expect(createWrapper(Plain)).toBe(createWrapper(Plain));
    expect(createWrapper(Plain, { element: "section" })).not.toBe(createWrapper(Plain));
    expect(
      createWrapper(Plain, { element: "section" }).eq(createWrapper(Plain, { element: "section" }))
    ).toBe(true);
    expect(createMarkShape(Plain)).toBe(createMarkShape(Plain));
    const wg = create({
      doc: "<blockquote><p>a</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Plain))],
    });
    expect(wg.contentDOM.innerHTML).toBe("<blockquote><p>a</p></blockquote>");
  });
});

describe("DecorationRoot", () => {
  // A new widget in each update, `eq` the last: its component keeps what it
  // drew, as Wordgard keeps an equal widget's DOM.
  it("doesn't render a widget's component again while the widget is eq", () => {
    const CountedType = createWidgetType<string>({ component: Counted, eq: (a, b) => a == b });
    const wg = create({
      doc: "<p>ab</p>",
      config: [
        basicSchema(),
        // A new widget in each update.
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.widget(CountedType.of("1")), 1]])
        ),
      ],
    });
    const before = counts.draws;
    const text = wg.contentDOM.querySelector("p")?.lastChild;
    if (!(text instanceof Text)) throw new Error("No text after the widget");
    typeInto(wg, text, 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
    expect(counts.draws).toBe(before);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a shape's root, its tag the node type's, without a warning", () => {
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    const wg = create({ doc: "<blockquote><p>a</p></blockquote>", config: quoteConfig() });
    const quote = wg.contentDOM.querySelector("blockquote");
    expect(quote?.className).toBe("quote");
    expect(quote?.querySelector(".body")?.innerHTML).toBe("<p>a</p>");
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("ax");
    expect(flushKeeps(wg)).toBe(true);
    error.mockRestore();
    warn.mockRestore();
  });

  it("puts Wordgard's attributes on the root, merged as the component says", () => {
    const wg = create({
      doc: "<blockquote><p>a</p></blockquote>",
      config: quoteConfig([
        Decoration.Tag.attribute(Blockquote, "class", "deco"),
        Decoration.Tag.attribute(Blockquote, "style", "margin-left: 2px; --gap: 1px"),
        Decoration.Tag.attribute(Blockquote, "data-kind", "theirs"),
        Decoration.Tag.attribute(Blockquote, "title", "Quote"),
      ]),
    });
    const quote = wg.contentDOM.querySelector<HTMLElement>("blockquote");
    expect(quote?.className).toBe("quote deco");
    expect(quote?.style.color).toBe("red");
    expect(quote?.style.marginLeft).toBe("2px");
    expect(quote?.style.getPropertyValue("--gap")).toBe("1px");
    // Written after the spread: the component's.
    expect(quote?.dataset["kind"]).toBe("mine");
    expect(quote?.title).toBe("Quote");
  });

  it("keeps Wordgard's style when the component drops its own", async () => {
    const wg = create({
      doc: "<blockquote><p>a</p></blockquote>",
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, createShape(Tinted)),
        Decoration.Tag.attribute(Blockquote, "style", "margin-left: 2px"),
      ],
    });
    const quote = wg.contentDOM.querySelector<HTMLElement>("blockquote");
    expect(quote?.style.marginLeft).toBe("2px");
    await set(wg, "tint", true);
    expect(quote?.style.color).toBe("red");
    expect(quote?.style.marginLeft).toBe("2px");
    await set(wg, "tint", false);
    expect(quote?.style.color).toBe("");
    expect(quote?.style.marginLeft).toBe("2px");
    expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
    expect(flushKeeps(wg)).toBe(true);
  });

  it("follows a heading's level", () => {
    const wg = create({
      doc: "<h1>a</h1><h3>b</h3>",
      config: [basicSchema(), Decoration.Tag.shape(Heading, createShape(Plain))],
    });
    expect(wg.contentDOM.innerHTML).toBe("<h1>a</h1><h3>b</h3>");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws an atom's root with the node's attributes and selection", () => {
    const wg = create({
      doc: '<p>a<img src="data:," alt="A cat">b</p>',
      config: [basicSchema(), image(), Decoration.Tag.shape(Image, createShape(Root))],
    });
    const img = wg.contentDOM.querySelector("img");
    expect(img?.getAttribute("src")).toBe("data:,");
    expect(img?.getAttribute("alt")).toBe("A cat");
    const found = wg.state.doc.nodeAt(2);
    if (!found) throw new Error("No image");
    wg.dispatch({ selection: GardSelection.node(2, found) });
    wg.flush();
    expect(wg.contentDOM.querySelector("img")).toBe(img);
    expect(img?.classList.contains("wg-selected-node")).toBe(true);
  });

  // Svelte leaves an anchor in an element whose children a template draws: a mark, whose elements
  // down to its content hold nothing else, draws its root by hand or holds its content in it.
  it("refuses children in a mark's root", () => {
    expect(() =>
      create({
        doc: '<p><a href="https://x.test/">ab</a></p>',
        config: [
          basicSchema(),
          Decoration.Mark.shape(Link, createMarkShape(LinkRoot, { element: "a" })),
        ],
      })
    ).toThrow("holds an empty text node or a comment beside its content");
  });

  it("draws a wrapper's root", () => {
    const wg = create({
      doc: "<p>ab</p>",
      config: [
        basicSchema(),
        Decoration.Tag.wrapper(Paragraph, createWrapper(FrameRoot, { element: "section" })),
      ],
    });
    expect(wg.contentDOM.querySelector("section.frame > p")?.textContent).toBe("ab");
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "section p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("is only a decoration's root", () => {
    const target = document.createElement("div");
    expect(() => unmount(mount(DecorationRoot, { target, props: {} }))).toThrow(
      /DecorationRoot is called outside a Svelte shape, wrapper, mark or widget/
    );
  });

  it("holds the content itself, and takes the root `of` gives", () => {
    const wg = create({
      doc: "<blockquote><p>a</p></blockquote>",
      config: [
        basicSchema(),
        blockquote(),
        Decoration.Tag.shape(Blockquote, createShape(Plain).of("div")),
        Decoration.Tag.attribute(Blockquote, "class", "plain"),
      ],
    });
    expect(wg.contentDOM.innerHTML).toContain('<div class="plain"><p>a</p></div>');
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});

const Badge = createWidgetType<string>({ component: BadgeView });
const Tag = createWidgetType<string>({ component: TagView, element: "i" });
const Icon = createWidgetType<null>({ component: IconView, element: "img" });

describe("DecorationRoot's children", () => {
  it("keeps an {#each}'s items apart from an {#if} beside them", async () => {
    const wg = create({
      doc: "<blockquote><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Listed))],
    });
    const chrome = () =>
      [...(wg.contentDOM.querySelector("blockquote")?.children ?? [])]
        .filter((elt) => !elt.classList.contains("body"))
        .map((elt) => `${elt.className}:${elt.textContent}`);
    expect(chrome()).toEqual(["bar:bar", "item:a", "item:b"]);
    const items = [...wg.contentDOM.querySelectorAll(".item")];
    await set(wg, "open", false);
    expect(chrome()).toEqual(["item:a", "item:b"]);
    expect([...wg.contentDOM.querySelectorAll(".item")]).toEqual(items);
    expect(flushKeeps(wg)).toBe(true);
  });
});

describe("DecorationRoot in a widget", () => {
  it("draws a non-editable widget's root as Wordgard does, never writing the attribute once it's in the page", () => {
    const wg = create({
      doc: "<p>ab</p>",
      config: [
        basicSchema(),
        Decoration.Tag.widget(Paragraph, "start", Badge.of("¶")),
        Decoration.Tag.widget(Paragraph, "start", Icon.of(null)),
      ],
    });
    const observer = new MutationObserver(() => {});
    observer.observe(wg.contentDOM, { subtree: true, attributeFilter: ["contenteditable"] });
    wg.dispatch({
      changes: { from: wg.state.doc.length, insert: [Paragraph.create([]), Paragraph.create([])] },
    });
    wg.flush();
    const written = observer.takeRecords().map((record) => record.target);
    observer.disconnect();
    const badges = [...wg.contentDOM.querySelectorAll(".badge")];
    const icons = [...wg.contentDOM.querySelectorAll(".icon")];
    expect(badges).toHaveLength(3);
    expect(icons).toHaveLength(3);
    for (const badge of badges) expect(badge.getAttribute("contenteditable")).toBe(null);
    for (const icon of icons) expect(icon.getAttribute("contenteditable")).toBe("false");
    expect(written).toEqual([]);
  });

  it("draws a widget's root, its element the widget type's, without a warning", () => {
    const error = vi.spyOn(console, "error");
    const warn = vi.spyOn(console, "warn");
    const wg = create({
      doc: "<p>ab</p>",
      config: [
        basicSchema(),
        Decoration.Tag.widget(Paragraph, "start", Badge.of("¶")),
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.widget(Tag.of("!")), 2]])
        ),
      ],
    });
    // DecorationRoot's {@render children?.()} leaves its comment in the root:
    // harmless in a widget, whose DOM Wordgard doesn't read.
    expect(wg.contentDOM.innerHTML.replaceAll("<!---->", "")).toBe(
      '<p><span class="badge" data-mount="1">¶</span>a<i>!</i>b</p>'
    );
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    // A fresh editor's badge is another mount.
    expect(drawn(wg).tiles).toEqual(fresh(wg).tiles);
    const text = wg.contentDOM.querySelector("p")?.childNodes[1];
    if (!(text instanceof Text)) throw new Error("No text after the badge");
    typeInto(wg, text, 0, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("xab");
    expect(flushKeeps(wg)).toBe(true);
    error.mockRestore();
    warn.mockRestore();
  });

  it("puts the attributes of the node a widget draws on its root", () => {
    const wg = create({
      doc: '<p>a<img src="data:," alt="A cat">b</p>',
      config: [
        basicSchema(),
        image(),
        Decoration.Tag.shape(Image, (tag) => Badge.of(tag.param.slice(0, 5))),
      ],
    });
    const badge = () => wg.contentDOM.querySelector(".badge");
    const before = badge();
    expect(before?.getAttribute("alt")).toBe("A cat");
    expect(before?.parentElement?.nodeName).toBe("P");
    const found = wg.state.doc.nodeAt(2);
    if (!found) throw new Error("No image");
    wg.dispatch({ selection: GardSelection.node(2, found) });
    wg.flush();
    expect(badge()).toBe(before);
    expect(before?.className).toBe("badge wg-selected-node");
    expect(counts.badges).toBe(1);
  });

  it("draws a widget drawing a node with attributes uneditable, block buffers around it", () => {
    const wg = create({
      doc: "<hr><p>a</p>",
      config: [
        basicSchema(),
        horizontalRule(),
        Decoration.Tag.shape(HorizontalRule, Badge.of("-")),
      ],
    });
    const badge = () => wg.contentDOM.querySelector(".badge");
    expect(badge()?.getAttribute("contenteditable")).toBe(null);
    const found = wg.state.doc.nodeAt(0);
    if (!found) throw new Error("No rule");
    wg.dispatch({ selection: GardSelection.node(0, found) });
    wg.flush();
    expect(badge()?.getAttribute("contenteditable")).toBe("false");
    expect(badge()?.previousElementSibling?.className).toBe("wg-blockBuffer");
    expect(badge()?.nextElementSibling?.nodeName).toBe("P");
  });
});
