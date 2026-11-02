// What keeps a React decoration's component, counted in mounts: a mark change,
// a retag (a node's opening token replaced by one of the same type, as
// Wordgard's commands change a parameter) and a move within the node's parent
// re-render it; a whole-node replacement, a type change and a move to another
// parent remount it.
import React, { useLayoutEffect } from "react";
import { Leaf } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import { alignment, basicSchema, blockquote, image, imageResizing } from "wordgard/schema";
import type { Transaction } from "wordgard/state";
import { Alignment, Blockquote, Heading, Image, ImageSize, Paragraph } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { createShape } from "../decorations/ReactShapeType.js";
import { composeIn, drawn, textIn, typeInto } from "../testing/editing.js";

const mounts = { heading: 0, image: 0, quote: 0 };

const HeadingShape = createShape(function HeadingShape({ children }) {
  useLayoutEffect(() => {
    mounts.heading++;
  }, []);
  return <DecorationRoot>{children}</DecorationRoot>;
});

const ImageShape = createShape(function ImageShape() {
  useLayoutEffect(() => {
    mounts.image++;
  }, []);
  return <DecorationRoot />;
});

// A container with chrome: a mark before its content.
const QuoteShape = createShape(function QuoteShape({ nodeProps: { contentDOMRef }, children }) {
  useLayoutEffect(() => {
    mounts.quote++;
  }, []);
  return (
    <DecorationRoot>
      <span className="lead">“</span>
      <div ref={contentDOMRef}>{children}</div>
    </DecorationRoot>
  );
});

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  Object.assign(mounts, { heading: 0, image: 0, quote: 0 });
});

const create = (doc: string) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = ReactWordgard.create({
    doc,
    config: [
      basicSchema(),
      alignment(),
      blockquote(),
      image(),
      imageResizing(),
      Decoration.Tag.shape(Heading, HeadingShape),
      Decoration.Tag.shape(Image, ImageShape),
      Decoration.Tag.shape(Blockquote, QuoteShape),
    ],
    parent,
  });
  wg.flush();
  editors.push(wg);
  return wg;
};

const fresh = (wg: Wordgard) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const other = ReactWordgard.create({ state: wg.state, parent });
  other.flush();
  editors.push(other);
  return drawn(other);
};

// Dispatches `spec` and returns the mounts it caused.
const remounts = (wg: Wordgard, spec: Transaction.Spec) => {
  const before = { ...mounts };
  wg.dispatch(spec);
  wg.flush();
  return {
    heading: mounts.heading - before.heading,
    image: mounts.image - before.image,
    quote: mounts.quote - before.quote,
  };
};

const src = (name: string) => `data:image/svg+xml,${name}`;
// A heading, then a paragraph with two images: the first image is at 4.
const doc = `<h1>a</h1><p><img src="${src("a")}"><img src="${src("b")}">c</p>`;

describe("React keys", () => {
  it("keep a component through a mark change", () => {
    const wg = create(doc);
    expect(mounts).toEqual({ heading: 1, image: 2, quote: 0 });
    expect(
      remounts(wg, {
        changes: [
          { from: 0, add: Alignment.of("center") },
          { from: 4, add: ImageSize.of(20) },
        ],
      })
    ).toEqual({ heading: 0, image: 0, quote: 0 });
    expect(wg.contentDOM.querySelector("h1")?.getAttribute("style")).toContain("center");
    expect(wg.contentDOM.querySelector("img")?.getAttribute("style")).toContain("20px");
    // React 19 puts an attribute added later after the others.
    expect(drawn(wg).tiles).toEqual(fresh(wg).tiles);
  });

  it("keep a component through a retag", () => {
    const wg = create(doc);
    expect(
      remounts(wg, {
        changes: [
          { from: 0, to: 1, insert: [Heading.of(2)] },
          { from: 4, to: 5, insert: [Image.of(src("x"))] },
        ],
      })
    ).toEqual({ heading: 0, image: 0, quote: 0 });
    expect(wg.contentDOM.querySelector("h2")?.textContent).toBe("a");
    expect(wg.contentDOM.querySelector("img")?.getAttribute("src")).toBe(src("x"));
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keep both components when two adjacent leaves are retagged together", () => {
    const wg = create(doc);
    // Wordgard's update merges the two replaced sections into one.
    expect(
      remounts(wg, {
        changes: [
          { from: 4, to: 5, insert: [Image.of(src("x"))] },
          { from: 5, to: 6, insert: [Image.of(src("y"))] },
        ],
      })
    ).toEqual({ heading: 0, image: 0, quote: 0 });
    expect(
      [...wg.contentDOM.querySelectorAll("img")].map((img) => img.getAttribute("src"))
    ).toEqual([src("x"), src("y")]);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("remount a component when its node is replaced whole", () => {
    const wg = create(doc);
    expect(
      remounts(wg, {
        changes: { from: 0, to: 3, insert: [Heading.of(1).create([Leaf.text("a")])] },
      })
    ).toEqual({ heading: 1, image: 0, quote: 0 });
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("remount a component when its node's type changes", () => {
    const wg = create(`<p>a</p>${doc}`);
    expect(mounts.heading).toBe(1);
    // The paragraph becomes a heading, and back.
    expect(remounts(wg, { changes: { from: 0, to: 1, insert: [Heading.of(1)] } })).toEqual({
      heading: 1,
      image: 0,
      quote: 0,
    });
    expect(remounts(wg, { changes: { from: 0, to: 1, insert: [Paragraph] } })).toEqual({
      heading: 0,
      image: 0,
      quote: 0,
    });
    expect(remounts(wg, { changes: { from: 0, to: 1, insert: [Heading.of(3)] } })).toEqual({
      heading: 1,
      image: 0,
      quote: 0,
    });
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // A heading, a quote holding a paragraph and a heading, a paragraph with two
  // images.
  const moveDoc = `<h1>a</h1><blockquote><p>q</p><h2>r</h2></blockquote><p><img src="${src("a")}"><img src="${src("b")}">c</p>`;

  const nodeAt = (wg: Wordgard, pos: number) => {
    const node = wg.state.doc.nodeAt(pos);
    if (!node) throw new Error(`No node at ${pos}`);
    return node;
  };

  // Moves the node at `from` to `to`, both in the current document.
  const move = (wg: Wordgard, from: number, to: number): Transaction.Spec => {
    const node = nodeAt(wg, from);
    return {
      changes: [
        { from, to: from + node.length },
        { from: to, insert: [node] },
      ],
    };
  };

  it("keep components through a move within the parent", () => {
    const wg = create(moveDoc);
    expect(mounts).toEqual({ heading: 2, image: 2, quote: 1 });
    const quote = wg.contentDOM.querySelector("blockquote");
    const lead = quote?.querySelector(".lead");
    // The quote, with the heading inside it, to the end of the document.
    expect(remounts(wg, move(wg, 3, wg.state.doc.length))).toEqual({
      heading: 0,
      image: 0,
      quote: 0,
    });
    expect(wg.contentDOM.lastElementChild).toBe(quote);
    expect(quote?.querySelector(".lead")).toBe(lead);
    expect(drawn(wg)).toEqual(fresh(wg));
    // The first image after the second, then back in one replaced section of
    // unchanged length, as a retag of both would be.
    const p = 4;
    const srcs = () =>
      [...wg.contentDOM.querySelectorAll("img")].map((img) => img.getAttribute("src"));
    expect(remounts(wg, move(wg, p, p + 2))).toEqual({ heading: 0, image: 0, quote: 0 });
    expect(srcs()).toEqual([src("b"), src("a")]);
    expect(drawn(wg)).toEqual(fresh(wg));
    const [imgB, imgA] = [nodeAt(wg, p), nodeAt(wg, p + 1)];
    expect(remounts(wg, { changes: { from: p, to: p + 2, insert: [imgA, imgB] } })).toEqual({
      heading: 0,
      image: 0,
      quote: 0,
    });
    expect(srcs()).toEqual([src("a"), src("b")]);
    expect(drawn(wg)).toEqual(fresh(wg));
    // The top heading after the paragraph.
    expect(remounts(wg, move(wg, 0, 3 + nodeAt(wg, 3).length))).toEqual({
      heading: 0,
      image: 0,
      quote: 0,
    });
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("remount a component moved to another parent", () => {
    const wg = create(moveDoc);
    // The top heading into the quote, before its paragraph.
    expect(remounts(wg, move(wg, 0, 4))).toEqual({ heading: 1, image: 0, quote: 0 });
    expect(wg.contentDOM.querySelector("blockquote h1")?.textContent).toBe("a");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("mount a copy of a node that stays", () => {
    const wg = create(moveDoc);
    const quote = wg.contentDOM.querySelector("blockquote");
    expect(
      remounts(wg, { changes: { from: wg.state.doc.length, insert: [nodeAt(wg, 3)] } })
    ).toEqual({ heading: 1, image: 0, quote: 1 });
    expect(wg.contentDOM.querySelectorAll("blockquote")[0]).toBe(quote);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("take typing and a composition beside a moved node", () => {
    const wg = create(`<p>x</p>${moveDoc}`);
    wg.dispatch(move(wg, 6, 0));
    wg.flush();
    expect(mounts.quote).toBe(1);
    // The paragraph now after the quote.
    const p = wg.contentDOM.children[1];
    if (!p) throw new Error("No paragraph");
    expect(p.textContent).toBe("x");
    typeInto(wg, textIn(wg, ":scope > p"), 1, "y");
    wg.flush();
    const composition = composeIn(wg, textIn(wg, ":scope > p"));
    composition.update(2, "z");
    wg.flush();
    composition.end();
    wg.flush();
    expect(mounts.quote).toBe(1);
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe("q|r|xyz|a|c");
    expect(drawn(wg)).toEqual(fresh(wg));
    // The quote moved back while a composition goes on in the paragraph.
    const mounted = mounts.quote;
    const node = textIn(wg, ":scope > p");
    const again = composeIn(wg, node);
    again.update(3, "w");
    wg.flush();
    const quote = nodeAt(wg, 0);
    wg.dispatch({
      changes: [
        { from: 0, to: quote.length },
        { from: quote.length + 6, insert: [quote] },
      ],
    });
    wg.flush();
    expect(textIn(wg, ":scope > p")).toBe(node);
    again.update(4, "v");
    wg.flush();
    again.end();
    wg.flush();
    expect(mounts.quote).toBe(mounted);
    expect(wg.state.doc.textContent({ blockSeparator: "|" })).toBe("xyzwv|q|r|a|c");
    expect(drawn(wg)).toEqual(fresh(wg));
  });
});
