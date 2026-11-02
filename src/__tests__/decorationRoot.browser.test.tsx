// DecorationRoot: the root of a React shape, wrapper or mark, drawn with the
// tag its Elt says, Wordgard's attributes and the root's ref, the component's
// own props merged in. Plain function components, so React 18 gives them no
// ref: DecorationRoot takes it from its context.
import React from "react";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, image } from "wordgard/schema";
import { GardSelection, type GardState } from "wordgard/state";
import { Blockquote, Heading, Image, Link, Paragraph } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
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

describe("DecorationRoot", () => {
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

  it("isn't a widget's root", () => {
    const Bad = createWidgetType({
      component: function Bad() {
        return <DecorationRoot />;
      },
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      create({
        doc: "<p>a</p>",
        config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", Bad.of(null))],
      })
    ).toThrow(/root of a React shape, wrapper or mark/);
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
