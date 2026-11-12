// Adapted from react-wordgard's decorationRoot.browser.test.tsx for Vue. Wordgard's attributes
// reach the root by falling through, merged by Vue's rules: classes joined, styles merged and,
// for the rest, Wordgard's winning.
import { createApp, defineComponent, h, nextTick, ref } from "vue";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, horizontalRule, image } from "wordgard/schema";
import { GardSelection, type GardState } from "wordgard/state";
import { Blockquote, Heading, HorizontalRule, Image, Link, Paragraph } from "wordgard/types";

import { drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { VueWordgard } from "../VueWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { NodeContent } from "../components/NodeContent.js";
import { WrappedNode } from "../components/WrappedNode.js";
import { createMarkShape } from "../decorations/VueMarkType.js";
import { createShape } from "../decorations/VueShapeType.js";
import { createWidgetType } from "../decorations/VueWidgetType.js";
import { createWrapper } from "../decorations/VueWrapperType.js";

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension }) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? VueWordgard.create({ state: spec.state, parent })
    : VueWordgard.create({ doc: spec.doc ?? "", config: spec.config ?? [], parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

// Vue's own warnings: the tests' template compiler has some of its own.
const vueWarnings = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.filter(([message]) => String(message).startsWith("[Vue warn]"));

// A quote with a decorative mark before its content, its class and style the
// component's own.
const QuoteShape = createShape(
  defineComponent({
    props: ["nodeProps"],
    components: { DecorationRoot, NodeContent },
    template: `
      <DecorationRoot class="quote" :style="{ color: 'red' }" data-kind="mine">
        <span aria-hidden="true">“</span>
        <NodeContent as="div" class="body" />
      </DecorationRoot>`,
  })
);

const quoteConfig = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, QuoteShape),
  extra,
];

const Plain = defineComponent({
  props: ["nodeProps"],
  components: { DecorationRoot },
  template: `<DecorationRoot content />`,
});

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
    const draws = { count: 0 };
    const Counted = createWidgetType({
      // A render function, to count the component's renders.
      component: defineComponent({
        props: ["value"],
        setup: (props) => () => {
          draws.count++;
          return h(DecorationRoot, () => String(props.value));
        },
      }),
      eq: (a, b) => a == b,
    });
    const wg = create({
      doc: "<p>ab</p>",
      config: [
        basicSchema(),
        // A new widget in each update.
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.widget(Counted.of("1")), 1]])
        ),
      ],
    });
    const before = draws.count;
    const text = wg.contentDOM.querySelector("p")?.lastChild;
    if (!(text instanceof Text)) throw new Error("No text after the widget");
    typeInto(wg, text, 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
    expect(draws.count).toBe(before);
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
    expect(vueWarnings(warn)).toEqual([]);
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("ax");
    expect(flushKeeps(wg)).toBe(true);
    error.mockRestore();
    warn.mockRestore();
  });

  it("merges the component's attributes with Wordgard's, as Vue merges fallthrough ones", () => {
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
    expect(quote?.dataset["kind"]).toBe("theirs");
    expect(quote?.title).toBe("Quote");
  });

  it("keeps Wordgard's style when the component drops its own", async () => {
    const tint = ref(false);
    const Tinted = defineComponent({
      props: ["nodeProps"],
      components: { DecorationRoot },
      setup: () => ({ tint }),
      template: `<DecorationRoot content :style="tint ? { color: 'red' } : undefined" />`,
    });
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
    tint.value = true;
    await nextTick();
    expect(quote?.style.color).toBe("red");
    expect(quote?.style.marginLeft).toBe("2px");
    tint.value = false;
    await nextTick();
    expect(quote?.style.color).toBe("");
    expect(quote?.style.marginLeft).toBe("2px");
    expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
  });

  it("follows a heading's level", () => {
    const HeadingShape = createShape(Plain);
    const wg = create({
      doc: "<h1>a</h1><h3>b</h3>",
      config: [basicSchema(), Decoration.Tag.shape(Heading, HeadingShape)],
    });
    expect(wg.contentDOM.innerHTML).toBe("<h1>a</h1><h3>b</h3>");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws an atom's root with the node's attributes and selection", () => {
    const ImageShape = createShape(
      defineComponent({
        props: ["nodeProps"],
        components: { DecorationRoot },
        template: `<DecorationRoot />`,
      })
    );
    const wg = create({
      doc: '<p>a<img src="data:," alt="A cat">b</p>',
      config: [basicSchema(), image(), Decoration.Tag.shape(Image, ImageShape)],
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

  it("draws a mark's and a wrapper's root", () => {
    const LinkMark = createMarkShape(
      defineComponent({
        props: ["markProps"],
        components: { DecorationRoot, NodeContent },
        template: `
          <DecorationRoot :href="String(markProps.mark.value)">
            <NodeContent as="span" />
          </DecorationRoot>`,
      }),
      { element: "a" }
    );
    const Frame = createWrapper(
      defineComponent({
        props: ["nodeProps"],
        components: { DecorationRoot, WrappedNode },
        template: `
          <DecorationRoot class="frame">
            <span aria-hidden="true">⋮</span>
            <WrappedNode />
          </DecorationRoot>`,
      }),
      { element: "section" }
    );
    const wg = create({
      doc: '<p><a href="https://x.test/">ab</a></p>',
      config: [
        basicSchema(),
        Decoration.Mark.shape(Link, LinkMark),
        Decoration.Tag.wrapper(Paragraph, Frame),
      ],
    });
    expect(wg.contentDOM.querySelector("section.frame > p > a")?.getAttribute("href")).toBe(
      "https://x.test/"
    );
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "a span"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axb");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("is only a decoration's root", () => {
    let thrown: unknown = null;
    const app = createApp(DecorationRoot);
    app.config.errorHandler = (error) => {
      thrown = error;
    };
    app.mount(document.createElement("div"));
    expect(String(thrown)).toMatch(/root of a Vue shape, wrapper, mark or widget/);
    app.unmount();
  });

  it("holds the content itself, and takes the root `of` gives", () => {
    const Classed = createShape(
      defineComponent({
        props: ["nodeProps"],
        components: { DecorationRoot },
        template: `<DecorationRoot content class="plain" />`,
      })
    );
    const wg = create({
      doc: "<blockquote><p>a</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, Classed.of("div"))],
    });
    expect(wg.contentDOM.innerHTML).toContain('<div class="plain"><p>a</p></div>');
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // The gate's "a component updating from its own state", with the content in
  // its root: it moves in and out of an inner element, the root staying.
  it("keeps its element while the content moves in and out of it", async () => {
    const boxed = ref(false);
    const Box = createShape(
      defineComponent({
        props: ["nodeProps"],
        components: { DecorationRoot, NodeContent },
        setup: () => ({ boxed }),
        template: `
          <DecorationRoot :content="!boxed">
            <NodeContent v-if="boxed" as="div" class="box" />
          </DecorationRoot>`,
      })
    );
    const wg = create({
      doc: "<blockquote><p>a</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, Box)],
    });
    const quote = wg.contentDOM.querySelector("blockquote");
    boxed.value = true;
    await nextTick();
    expect(quote?.innerHTML).toBe('<div class="box"><p>a</p></div>');
    expect(flushKeeps(wg)).toBe(true);
    boxed.value = false;
    await nextTick();
    expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
    expect(quote?.innerHTML).toBe("<p>a</p>");
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("ax");
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});

const badgeMounts = { count: 0 };
const Badge = createWidgetType({
  component: defineComponent({
    props: ["value"],
    components: { DecorationRoot },
    setup: () => ({ mount: ++badgeMounts.count }),
    template: `<DecorationRoot class="badge" :data-mount="mount">{{ value }}</DecorationRoot>`,
  }),
});
const Tag = createWidgetType({
  component: defineComponent({
    props: ["value"],
    components: { DecorationRoot },
    template: `<DecorationRoot>{{ value }}</DecorationRoot>`,
  }),
  element: "i",
});
const Icon = createWidgetType({
  component: defineComponent({
    props: ["value"],
    components: { DecorationRoot },
    template: `<DecorationRoot class="icon" alt="" />`,
  }),
  element: "img",
});

describe("DecorationRoot's slot", () => {
  // A `v-if` keys its branch 0, as a `v-for` may its first item.
  it("keeps a v-for's items apart from a v-if beside them", async () => {
    const open = ref(true);
    const Quote = createShape(
      defineComponent({
        props: ["nodeProps"],
        components: { DecorationRoot, NodeContent },
        setup: () => ({ open, items: ["a", "b"] }),
        template: `
          <DecorationRoot>
            <div v-if="open" class="bar">bar</div>
            <div v-for="(item, i) in items" :key="i" class="item">{{ item }}</div>
            <NodeContent as="div" class="body" />
          </DecorationRoot>`,
      })
    );
    const wg = create({
      doc: "<blockquote><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, Quote)],
    });
    const chrome = () =>
      [...(wg.contentDOM.querySelector("blockquote")?.children ?? [])]
        .filter((elt) => !elt.classList.contains("body"))
        .map((elt) => `${elt.className}:${elt.textContent}`);
    expect(chrome()).toEqual(["bar:bar", "item:a", "item:b"]);
    const items = [...wg.contentDOM.querySelectorAll(".item")];
    open.value = false;
    await nextTick();
    expect(chrome()).toEqual(["item:a", "item:b"]);
    expect([...wg.contentDOM.querySelectorAll(".item")]).toEqual(items);
    expect(flushKeeps(wg)).toBe(true);
  });
});

describe("DecorationRoot in a widget", () => {
  afterEach(() => {
    badgeMounts.count = 0;
  });

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
    expect(wg.contentDOM.innerHTML).toBe(
      '<p><span class="badge" data-mount="1">¶</span>a<i>!</i>b</p>'
    );
    expect(error).not.toHaveBeenCalled();
    expect(vueWarnings(warn)).toEqual([]);
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
    expect(badgeMounts.count).toBe(1);
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
