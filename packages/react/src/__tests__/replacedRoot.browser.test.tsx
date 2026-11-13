// A React decoration whose component replaces its root element from its own state (here, another
// key): the tiles are rebuilt over the new root before Wordgard reads them, so the next flush
// keeps them, and the document stays editable.
import React, { forwardRef, useLayoutEffect, useState } from "react";
import { flushSync } from "react-dom";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote, Link } from "wordgard/types";

import { ReactWordgard } from "../ReactWordgard.js";
import { type MarkComponentProps, createMarkShape } from "../decorations/ReactMarkType.js";
import { type ShapeComponentProps, createShape } from "../decorations/ReactShapeType.js";
import { type WidgetComponentProps, createWidgetType } from "../decorations/ReactWidgetType.js";
import { type WrapperComponentProps, createWrapper } from "../decorations/ReactWrapperType.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";

// The key every component starts with, and each editor's setters, in the order the components
// mounted (children first).
const initial = { key: 0 };
const swaps = new Map<Wordgard, ((key: number) => void)[]>();
const bars = new Map<Wordgard, ((on: boolean) => void)[]>();

const useSwap = () => {
  const wg = useWordgard();
  const [key, setKey] = useState(initial.key);
  useLayoutEffect(() => {
    swaps.set(wg, [...(swaps.get(wg) ?? []), setKey]);
  }, [wg]);
  return key;
};

const Callout = forwardRef<HTMLDivElement, ShapeComponentProps<HTMLDivElement>>(
  ({ nodeProps: { contentDOMRef }, children, ...attrs }, ref) => {
    const wg = useWordgard();
    const key = useSwap();
    const [bar, setBar] = useState(false);
    useLayoutEffect(() => {
      bars.set(wg, [...(bars.get(wg) ?? []), setBar]);
    }, [wg]);
    return (
      <div key={key} {...attrs} ref={ref} data-key={key}>
        {bar && <i className="bar">!</i>}
        <div className="body" ref={contentDOMRef}>
          {children}
        </div>
      </div>
    );
  }
);

const Frame = forwardRef<HTMLElement, WrapperComponentProps>(
  ({ nodeProps, children, ...attrs }, ref) => {
    const key = useSwap();
    return (
      <section key={key} {...attrs} ref={ref} data-key={key}>
        {children}
      </section>
    );
  }
);

const LinkView = forwardRef<HTMLAnchorElement, MarkComponentProps<HTMLAnchorElement>>(
  ({ markProps: { mark, contentDOMRef }, children, ...attrs }, ref) => {
    const key = useSwap();
    return (
      <a key={key} {...attrs} ref={ref} href={String(mark.value)} data-key={key}>
        <span className="text" ref={contentDOMRef}>
          {children}
        </span>
      </a>
    );
  }
);

const Badge = createWidgetType({
  component: forwardRef<HTMLElement, WidgetComponentProps<null>>((_, ref) => {
    const key = useSwap();
    return <i key={key} ref={ref} className="badge" data-key={key} />;
  }),
});

const editors: ReactWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  swaps.clear();
  bars.clear();
  initial.key = 0;
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

// What a fresh editor draws for the same state, its components drawing `key`.
const fresh = (wg: Wordgard, key: number) => {
  initial.key = key;
  const found = drawn(create({ state: wg.state }));
  initial.key = 0;
  return found;
};

const swap = (wg: Wordgard, key: number) => {
  const found = swaps.get(wg)?.[0];
  if (!found) throw new Error("Nothing drawn");
  flushSync(() => found(key));
};

const cases: { name: string; doc: string; config: GardState.Extension; text: string }[] = [
  {
    name: "shape",
    doc: "<p>a</p><blockquote><p>bc</p></blockquote>",
    config: [basicSchema(), blockquote(), Decoration.Tag.shape(Blockquote, createShape(Callout))],
    text: ".body p",
  },
  {
    name: "wrapper",
    doc: "<p>a</p><blockquote><p>bc</p></blockquote>",
    config: [
      basicSchema(),
      blockquote(),
      Decoration.Tag.wrapper(Blockquote, createWrapper(Frame, { element: "section" })),
    ],
    text: "blockquote p",
  },
  {
    name: "mark",
    doc: '<p>a<a href="x">bc</a>d</p>',
    config: [
      basicSchema(),
      Decoration.Mark.shape(Link, createMarkShape(LinkView, { element: "a" })),
    ],
    text: ".text",
  },
  {
    name: "widget",
    doc: "<p>abc</p>",
    config: [
      basicSchema(),
      Decoration.Point.source.of(() =>
        Decoration.Point.set([[Decoration.Point.widget(Badge.of(null)), 2]])
      ),
    ],
    text: "p",
  },
];

describe("A React decoration replacing its root on its own", () => {
  for (const { name, doc, config, text } of cases) {
    it(`rebuilds a ${name}'s tiles over the new root`, async () => {
      const wg = create({ doc, config });
      const old = wg.contentDOM.querySelector("[data-key]");
      swap(wg, 1);
      expect(wg.contentDOM.querySelector("[data-key]")).not.toBe(old);
      // The observer's callback, a microtask after the commit.
      await Promise.resolve();
      expect(flushKeeps(wg)).toBe(true);
      expect(drawn(wg)).toEqual(fresh(wg, 1));
      typeInto(wg, textIn(wg, text), 1, "x");
      wg.flush();
      expect(wg.state.doc.textContent()).toContain("x");
      expect(drawn(wg)).toEqual(fresh(wg, 1));
    });

    it(`rebuilds a ${name}'s tiles when a flush comes first`, () => {
      const wg = create({ doc, config });
      swap(wg, 1);
      swap(wg, 2);
      const before = wg.state.doc.toString();
      typeInto(wg, textIn(wg, text), 1, "x");
      wg.flush();
      expect(wg.state.doc.toString()).not.toBe(before);
      expect(wg.state.doc.textContent()).toContain("x");
      expect(drawn(wg)).toEqual(fresh(wg, 2));
    });
  }

  // The parent's tiles are rebuilt after the child's: they keep the child's.
  it("rebuilds a nested shape replaced as its parent changes, in one commit", async () => {
    const [shape] = cases;
    if (!shape) throw new Error("No shape case");
    const wg = create({
      doc: "<p>a</p><blockquote><p>x</p><blockquote><p>bc</p></blockquote></blockquote>",
      config: shape.config,
    });
    const [inner] = swaps.get(wg) ?? [];
    const [, outer] = bars.get(wg) ?? [];
    if (!inner || !outer) throw new Error("Not drawn");
    flushSync(() => {
      outer(true);
      inner(1);
    });
    await Promise.resolve();
    expect(wg.contentDOM.querySelectorAll(".bar").length).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".body .body p"), 1, "y");
    wg.flush();
    expect(wg.state.doc.textContent()).toContain("byc");
    expect(wg.contentDOM.querySelector(".body .body p")?.textContent).toBe("byc");
  });
});
