// Adapted from react-wordgard's replacedRoot browser test for Svelte: a decoration whose component
// replaces its root from its own state (a {#key} at its top). Svelte draws the new root in the
// holder, which puts it in place; the tiles are rebuilt over it before Wordgard reads them, so the
// next flush keeps them, and the document stays editable.
import { flushSync } from "svelte";
import { Leaf } from "wordgard/doc";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote, Link } from "wordgard/types";

import { tick } from "../testing/tick.js";
import { drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { createMarkShape } from "../decorations/SvelteMarkType.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import { createWrapper } from "../decorations/SvelteWrapperType.js";
import Swapping from "./fixtures/Swapping.svelte";
import { controls, initial, reset } from "./fixtures/controls.js";

const SwappingWidget = createWidgetType<null>({ component: Swapping, element: "i" });

const editors: SvelteWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  reset();
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

// What a fresh editor draws for the same state, its components drawing `key`.
const fresh = (wg: Wordgard, key: number) => {
  initial.key = key;
  const found = drawn(create({ state: wg.state }));
  initial.key = 0;
  return found;
};

const swap = (wg: Wordgard, key: number) => {
  const found = controls.get(wg)?.[0];
  if (!found) throw new Error("Nothing drawn");
  found.set("key", key);
};

const cases: { name: string; doc: string; config: GardState.Extension; text: string }[] = [
  {
    name: "shape",
    doc: "<p>a</p><blockquote><p>bc</p></blockquote>",
    config: [
      basicSchema(),
      blockquote(),
      Decoration.Tag.shape(Blockquote, createShape(Swapping).of("div")),
    ],
    text: ".body p",
  },
  {
    name: "wrapper",
    doc: "<p>a</p><blockquote><p>bc</p></blockquote>",
    config: [
      basicSchema(),
      blockquote(),
      Decoration.Tag.wrapper(Blockquote, createWrapper(Swapping, { element: "section" })),
    ],
    text: "blockquote p",
  },
  {
    name: "mark",
    doc: '<p>a<a href="x">bc</a>d</p>',
    config: [
      basicSchema(),
      Decoration.Mark.shape(Link, createMarkShape(Swapping, { element: "a" })),
    ],
    text: ".text",
  },
  {
    name: "widget",
    doc: "<p>abc</p>",
    config: [
      basicSchema(),
      Decoration.Point.source.of(() =>
        Decoration.Point.set([[Decoration.Point.widget(SwappingWidget.of(null)), 2]])
      ),
    ],
    text: "p",
  },
];

describe("A Svelte decoration replacing its root on its own", () => {
  for (const { name, doc, config, text } of cases) {
    it(`rebuilds a ${name}'s tiles over the new root`, async () => {
      const wg = create({ doc, config });
      const old = wg.contentDOM.querySelector("[data-key]");
      swap(wg, 1);
      await tick();
      // The observers' callbacks: the holder's, then Wordgard's.
      await Promise.resolve();
      const root = wg.contentDOM.querySelector("[data-key]");
      expect(root).not.toBe(old);
      expect(root?.getAttribute("data-key")).toBe("1");
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
      flushSync();
      swap(wg, 2);
      flushSync();
      // Before the observers' callbacks: Wordgard's flush puts the root in place.
      wg.dispatch({ changes: { from: 2, insert: [Leaf.text("x")] } });
      wg.flush();
      expect(drawn(wg)).toEqual(fresh(wg, 2));
      typeInto(wg, textIn(wg, text), 1, "y");
      wg.flush();
      expect(wg.state.doc.textContent()).toContain("y");
      expect(drawn(wg)).toEqual(fresh(wg, 2));
    });
  }

  // Nested roots are mounted outside their parent's effects: a parent's block
  // going in the same flush doesn't stop the child updating.
  it("replaces nested roots in one flush, both updating after", async () => {
    const [shape] = cases;
    if (!shape) throw new Error("No shape case");
    const wg = create({
      doc: "<p>a</p><blockquote><p>x</p><blockquote><p>bc</p></blockquote></blockquote>",
      config: shape.config,
    });
    const [outer, inner] = controls.get(wg) ?? [];
    if (!outer || !inner) throw new Error("Not drawn");
    const keys = () =>
      [...wg.contentDOM.querySelectorAll("[data-key]")].map((root) =>
        root.getAttribute("data-key")
      );
    outer.set("key", 1);
    inner.set("key", 1);
    await tick();
    await Promise.resolve();
    expect(keys()).toEqual(["1", "1"]);
    inner.set("key", 2);
    await tick();
    await Promise.resolve();
    expect(keys()).toEqual(["1", "2"]);
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, ".body .body p"), 1, "y");
    wg.flush();
    expect(wg.contentDOM.querySelector(".body .body p")?.textContent).toBe("byc");
    expect(wg.state.doc.textContent()).toContain("byc");
  });
});
