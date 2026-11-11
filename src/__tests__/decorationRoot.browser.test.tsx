// Plain function components here, so React 18 gives them no ref: DecorationRoot takes it from its
// context.
import React, { memo, useContext, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, horizontalRule, image } from "wordgard/schema";
import { GardSelection, type GardState } from "wordgard/state";
import { Blockquote, Heading, HorizontalRule, Image, Link, Paragraph } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { ErrorBoundary } from "../components/ErrorBoundary.js";
import { DecorationRootContext } from "../contexts/DecorationRootContext.js";
import { createMarkShape } from "../decorations/ReactMarkType.js";
import { createShape } from "../decorations/ReactShapeType.js";
import { createWidgetType } from "../decorations/ReactWidgetType.js";
import { createWrapper } from "../decorations/ReactWrapperType.js";
import { drawn, flushKeeps, textIn, typeInto } from "../testing/editing.js";

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension }) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? ReactWordgard.create({ state: spec.state, parent })
    : ReactWordgard.create({ doc: spec.doc ?? "", config: spec.config ?? [], parent });
  wg.flush();
  editors.push(wg);
  return wg;
};

const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

// A quote with a decorative mark before its content, its class, style and ref
// the component's own.
let quoteRoot: Element | null = null;
const QuoteShape = createShape(function Quote({ nodeProps: { contentDOMRef }, children }) {
  return (
    <DecorationRoot
      ref={(dom) => {
        quoteRoot = dom;
      }}
      className="quote"
      style={{ color: "red" }}
      data-kind="mine"
    >
      <span aria-hidden="true">“</span>
      <div className="body" ref={contentDOMRef}>
        {children}
      </div>
    </DecorationRoot>
  );
});

const quoteConfig = (extra: GardState.Extension = []) => [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, QuoteShape),
  extra,
];

// Composed per call, as an app folding extensions' components might.
const Plain = ({ children }: { children?: React.ReactNode }) => (
  <DecorationRoot>{children}</DecorationRoot>
);

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

// A reader of DecorationRoot's context that renders only when the value
// changes, counting its commits.
const countingReader = (reads: { count: number }) =>
  memo(function Reader() {
    useContext(DecorationRootContext);
    useLayoutEffect(() => {
      reads.count++;
    });
    return null;
  });

// Attributes from a point decoration: a new Elt for the quote in each layout.
const quoteKind = Decoration.Point.source.of(() =>
  Decoration.Point.set([[Decoration.Point.attributes({ "data-kind": "quote" }), 0]])
);

describe("DecorationRoot", () => {
  it("keeps its context's value while the node's attributes hold", () => {
    // A node drawn again for a change inside it, its attributes the same: the
    // same value, or React renders every reader of the context in it (on React
    // 19, every DecorationRoot below, which made a key in a section cost every
    // paragraph's).
    const reads = { count: 0 };
    const Reader = countingReader(reads);
    const draws = { count: 0 };
    const Quote = createShape(function Quote({ nodeProps: { contentDOMRef }, children }) {
      draws.count++;
      return (
        <DecorationRoot>
          <Reader />
          <div ref={contentDOMRef}>{children}</div>
        </DecorationRoot>
      );
    });
    const wg = create({
      doc: "<blockquote><p>a</p><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, Quote), quoteKind],
    });
    expect(wg.contentDOM.querySelector("blockquote")?.dataset.kind).toBe("quote");
    const [drawsBefore, readsBefore] = [draws.count, reads.count];
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(textIn(wg, "blockquote p").data).toBe("ax");
    expect(draws.count).toBeGreaterThan(drawsBefore);
    expect(reads.count).toBe(readsBefore);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps a wrapper's context value while its attributes hold", () => {
    const reads = { count: 0 };
    const Reader = countingReader(reads);
    const Frame = createWrapper(function Frame({ children }) {
      return (
        <DecorationRoot className="frame">
          <Reader />
          {children}
        </DecorationRoot>
      );
    });
    const wg = create({
      doc: "<blockquote><p>a</p><p>b</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.wrapper(Blockquote, Frame), quoteKind],
    });
    expect(wg.contentDOM.querySelector("[data-kind=quote]")).not.toBeNull();
    const readsBefore = reads.count;
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(textIn(wg, "blockquote p").data).toBe("ax");
    expect(reads.count).toBe(readsBefore);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a shape's root, its tag the node type's, without a warning", () => {
    const error = vi.spyOn(console, "error");
    const wg = create({ doc: "<blockquote><p>a</p></blockquote>", config: quoteConfig() });
    const quote = wg.contentDOM.querySelector("blockquote");
    expect(quote?.className).toBe("quote");
    expect(quote?.querySelector(".body")?.innerHTML).toBe("<p>a</p>");
    expect(quoteRoot).toBe(quote);
    expect(error).not.toHaveBeenCalled();
    expect(drawn(wg)).toEqual(fresh(wg));
    typeInto(wg, textIn(wg, "blockquote p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("ax");
    expect(flushKeeps(wg)).toBe(true);
    error.mockRestore();
  });

  it("merges the component's props with Wordgard's attributes", () => {
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
    expect(quote?.className).toBe("deco quote");
    expect(quote?.style.color).toBe("red");
    expect(quote?.style.marginLeft).toBe("2px");
    expect(quote?.style.getPropertyValue("--gap")).toBe("1px");
    expect(quote?.dataset["kind"]).toBe("mine");
    expect(quote?.title).toBe("Quote");
  });

  // React 18 would set Wordgard's style string, then clear the properties the
  // dropped object had, Wordgard's among them.
  it("keeps Wordgard's style when the component drops its own", () => {
    const control: { tint: ((on: boolean) => void) | null } = { tint: null };
    const Tinted = ({ children }: { children?: React.ReactNode }) => {
      const [tint, setTint] = useState(false);
      useLayoutEffect(() => {
        control.tint = (on) => flushSync(() => setTint(on));
      }, []);
      return (
        <DecorationRoot style={tint ? { color: "red" } : undefined}>{children}</DecorationRoot>
      );
    };
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
    expect(quote?.getAttribute("style")).toBe("margin-left: 2px");
    control.tint?.(true);
    expect(quote?.style.color).toBe("red");
    expect(quote?.style.marginLeft).toBe("2px");
    control.tint?.(false);
    expect(quote?.style.color).toBe("");
    expect(quote?.style.marginLeft).toBe("2px");
    expect(wg.contentDOM.querySelector("blockquote")).toBe(quote);
  });

  it("follows a heading's level", () => {
    const HeadingShape = createShape(function HeadingShape({ children }) {
      return <DecorationRoot>{children}</DecorationRoot>;
    });
    const wg = create({
      doc: "<h1>a</h1><h3>b</h3>",
      config: [basicSchema(), Decoration.Tag.shape(Heading, HeadingShape)],
    });
    expect(wg.contentDOM.innerHTML).toBe("<h1>a</h1><h3>b</h3>");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws an atom's root with the node's attributes and selection", () => {
    const ImageShape = createShape(function ImageShape() {
      return <DecorationRoot />;
    });
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
      function LinkMark({ markProps: { mark, contentDOMRef }, children }) {
        return (
          <DecorationRoot href={String(mark.value)}>
            <span ref={contentDOMRef}>{children}</span>
          </DecorationRoot>
        );
      },
      { element: "a" }
    );
    const Frame = createWrapper(
      function Frame({ children }) {
        return (
          <DecorationRoot className="frame">
            <span aria-hidden="true">⋮</span>
            {children}
          </DecorationRoot>
        );
      },
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
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const root = createRoot(document.createElement("div"));
    // React 19 doesn't rethrow a render error from flushSync: caught here.
    let thrown: unknown = null;
    flushSync(() =>
      root.render(
        <ErrorBoundary onError={(e) => (thrown = e)}>
          <DecorationRoot />
        </ErrorBoundary>
      )
    );
    expect(String(thrown)).toMatch(/root of a React shape, wrapper, mark or widget/);
    root.unmount();
    error.mockRestore();
  });

  it("holds the content itself, and takes the root `of` gives", () => {
    const Plain = createShape(function Plain({ nodeProps: { contentDOMRef }, children }) {
      return (
        <DecorationRoot ref={contentDOMRef} className="plain">
          {children}
        </DecorationRoot>
      );
    });
    const wg = create({
      doc: "<blockquote><p>a</p></blockquote>",
      config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, Plain.of("div"))],
    });
    expect(wg.contentDOM.innerHTML).toContain('<div class="plain"><p>a</p></div>');
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});

// Plain function components, so React 18 gives them no ref: DecorationRoot
// takes it from its context, in a widget as in a shape.
const badgeMounts = { count: 0 };
const Badge = createWidgetType({
  component: function Badge({ value }: { value: string }) {
    const [mount] = React.useState(() => ++badgeMounts.count);
    return (
      <DecorationRoot className="badge" data-mount={mount}>
        {value}
      </DecorationRoot>
    );
  },
});
const Tag = createWidgetType({
  component: function Tag({ value }: { value: string }) {
    return <DecorationRoot>{value}</DecorationRoot>;
  },
  element: "i",
});
const Icon = createWidgetType({
  component: function Icon() {
    return <DecorationRoot className="icon" alt="" />;
  },
  element: "img",
});

describe("DecorationRoot in a widget", () => {
  afterEach(() => {
    badgeMounts.count = 0;
  });

  // Wordgard 0.7.0 makes only a void root uneditable (docs/wordgard-upstream-bugs.md).
  it("draws a non-editable widget's root as Wordgard does, never writing the attribute once it's in the page", () => {
    const wg = create({
      doc: "<p>ab</p>",
      config: [
        basicSchema(),
        Decoration.Tag.widget(Paragraph, "start", Badge.of("¶")),
        Decoration.Tag.widget(Paragraph, "start", Icon.of(null)),
      ],
    });
    // Widgets built in a live editor (a document loaded into it): written after
    // React inserted them, the attribute costs a style invalidation over the
    // document (Chromium, with `:has()` rules on the page).
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
      '<p><span data-mount="1" class="badge">¶</span>a<i>!</i>b</p>'
    );
    expect(error).not.toHaveBeenCalled();
    // A fresh editor's badge is another mount.
    expect(drawn(wg).tiles).toEqual(fresh(wg).tiles);
    const text = wg.contentDOM.querySelector("p")?.childNodes[1];
    if (!(text instanceof Text)) throw new Error("No text after the badge");
    typeInto(wg, text, 0, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("xab");
    expect(flushKeeps(wg)).toBe(true);
    error.mockRestore();
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
    expect(before?.className).toBe("wg-selected-node badge");
    expect(badgeMounts.count).toBe(1);
  });

  // Wordgard puts the attributes on an element around the widget, which it
  // makes uneditable: React draws them on the widget's root.
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
