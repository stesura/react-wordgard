// Adapted from vue-wordgard's vueMark.browser.test.ts for Svelte: Svelte marks, written as users
// write them. After each change, Wordgard's next flush must find nothing to redraw, and the tiles
// must be what a fresh editor builds. svelteDecorations.browser.test.ts has the first drawing and
// the attributes a mark sets on its own.
import { Leaf } from "wordgard/doc";
import { Decoration, Widget, type Wordgard } from "wordgard/editor";
import { basicSchema, color, image } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Color, Link } from "wordgard/types";

import { tick } from "../testing/tick.js";
import { composeIn, drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { createMarkShape } from "../decorations/SvelteMarkType.js";
import Anchor from "./fixtures/mark/Anchor.svelte";
import Anchored from "./fixtures/mark/Anchored.svelte";
import ColorView from "./fixtures/mark/Color.svelte";
import CursorView from "./fixtures/mark/Cursor.svelte";
import LinkView from "./fixtures/mark/Link.svelte";
import { initial, links, resetMarks } from "./fixtures/mark/state.js";

const connected = { native: 0 };
const NativeMark = Widget.define<null>({
  render: () => Object.assign(document.createElement("span"), { className: "native" }),
  connect: () => connected.native++,
  disconnect: () => connected.native--,
});

const linkConfig = (extra: GardState.Extension = []) => [
  basicSchema(),
  image(),
  Decoration.Mark.shape(Link, createMarkShape(LinkView, { element: "a" })),
  extra,
];

const editors: SvelteWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  resetMarks();
  connected.native = 0;
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension } = {}) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? SvelteWordgard.create({ state: spec.state, parent })
    : SvelteWordgard.create({
        doc: spec.doc ?? '<p>a<a href="x">bc</a>d</p>',
        config: spec.config ?? linkConfig(),
        parent,
      });
  wg.flush();
  editors.push(wg);
  return wg;
};

// What a fresh editor draws for the same state, its components starting where
// `wg`'s are.
const fresh = (wg: Wordgard) => drawn(create({ state: wg.state }));

const control = (wg: Wordgard, index = 0) => {
  const found = links.get(wg)?.[index];
  if (!found) throw new Error("No link drawn");
  return found;
};

// Sets a link's state and waits for Svelte, then for Wordgard's DOM observer.
const set = async (wg: Wordgard, name: string, value: unknown) => {
  control(wg).set(name, value);
  await tick();
  await Promise.resolve();
};

describe("Svelte marks", () => {
  it("keeps the tiles right when the component changes its chrome on its own", async () => {
    const wg = create();
    await set(wg, "icon", false);
    expect(wg.contentDOM.querySelector("a .icon")).toBeNull();
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
    await set(wg, "icon", true);
    expect(flushKeeps(wg)).toBe(true);
    initial.icon = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("takes the user's typing in its content, with the chrome changing before the flush", async () => {
    const wg = create();
    typeInto(wg, textIn(wg, "a .text"), 1, "x");
    control(wg).set("icon", false);
    await tick();
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows content the component moves to another element, its DOM kept", async () => {
    const wg = create();
    const text = textIn(wg, "a .text");
    await set(wg, "boxed", true);
    expect(wg.contentDOM.querySelector("a .box b")?.textContent).toBe("bc");
    expect(textIn(wg, "a .box b")).toBe(text);
    initial.boxed = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "a .box b"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("moves the widgets of content it moves, drawn and connected once", async () => {
    const wg = create({
      config: linkConfig(
        Decoration.Point.source.of(() =>
          Decoration.Point.set([[Decoration.Point.widget(NativeMark.of(null)), 3]])
        )
      ),
    });
    const native = '<span class="native"></span>';
    expect(wg.contentDOM.querySelector("a .text")?.innerHTML).toBe(`b${native}c`);
    expect(connected.native).toBe(1);
    await set(wg, "boxed", true);
    expect(wg.contentDOM.querySelector("a .box")?.innerHTML).toBe(`<b>b${native}c</b>`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    initial.boxed = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    // The fresh editor connected a widget of its own.
    connected.native--;
    initial.boxed = false;
    await set(wg, "boxed", false);
    expect(wg.contentDOM.querySelector("a .text")?.innerHTML).toBe(`b${native}c`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // The gate's "a composition inside a Svelte mark", its chrome changing.
  it("keeps a composition in its content while the chrome changes", async () => {
    const wg = create();
    const sel = document.getSelection();
    const node = textIn(wg, "a .text");
    const composition = composeIn(wg, node);
    composition.update(1, "-");
    wg.flush();
    control(wg).set("icon", false);
    await tick();
    expect(sel?.focusNode).toBe(node);
    composition.update(2, "*");
    wg.flush();
    expect(sel?.focusNode).toBe(node);
    expect(node.isConnected).toBe(true);
    composition.end();
    wg.flush();
    expect(String(wg.state.doc)).toContain("b-*c");
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws one component around a run, other marks and inline nodes inside", () => {
    const wg = create({
      doc: '<p>a<a href="x">b<strong>c</strong><img src="data:,">d</a>e</p>',
    });
    expect(wg.contentDOM.querySelectorAll("a").length).toBe(1);
    expect(wg.contentDOM.querySelector("a .text")?.innerHTML).toMatch(
      /^b<strong>c<\/strong><img [^>]*>d$/
    );
    expect(control(wg).getPos()).toBe(2);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("draws a component per mark where the marks differ", () => {
    const wg = create({ doc: '<p><a href="x">b</a><a href="y">c</a></p>' });
    expect([...wg.contentDOM.querySelectorAll("a")].map((a) => a.getAttribute("href"))).toEqual([
      "x",
      "y",
    ]);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("gives the component its new mark when it changes", () => {
    const wg = create();
    expect(control(wg).mark().type).toBe(Link);
    wg.dispatch({
      changes: { from: 2, to: 4, insert: [Leaf.text("bc", [Link.of("y")])] },
    });
    wg.flush();
    expect(wg.contentDOM.querySelector("a")?.getAttribute("href")).toBe("y");
    // The same component, or one mounted for the new mark.
    expect(links.get(wg)?.at(-1)?.mark().value).toBe("y");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("turns an attribute-shaped mark into a wrapper, its root holding the content", () => {
    const wg = create({
      doc: '<p>a<span style="color: red">bc</span>d</p>',
      config: [basicSchema(), color(), Decoration.Mark.shape(Color, createMarkShape(ColorView))],
    });
    expect(wg.contentDOM.innerHTML).toBe('<p>a<span class="color" data-color="red">bc</span>d</p>');
    typeInto(wg, textIn(wg, ".color"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("rebuilds a mark the editor state changes in a flush that only moves the selection", () => {
    const wg = create({
      config: [basicSchema(), Decoration.Mark.shape(Link, createMarkShape(CursorView))],
    });
    expect(wg.contentDOM.querySelector(".here")).toBeNull();
    wg.dispatch({ selection: { anchor: 3 } });
    wg.flush();
    expect(wg.contentDOM.querySelector(".marker .here")).not.toBeNull();
    expect(wg.contentDOM.querySelector(".marker")?.getAttribute("contenteditable")).toBe("false");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // Wordgard resolves positions through a mark's elements: an {#if}'s comment
  // there would shift them.
  it("refuses an {#if}'s comment among a mark's elements", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      create({ config: [basicSchema(), Decoration.Mark.shape(Link, createMarkShape(Anchored))] })
    ).toThrow(/A Svelte mark holds an empty text node or a comment beside its content/);
    error.mockRestore();
  });

  it("says when the component's root isn't the mark's element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    create({ config: [basicSchema(), Decoration.Mark.shape(Link, createMarkShape(Anchor))] });
    expect(error.mock.calls.flat().join("")).toContain(
      "A Svelte mark's component drew <a> where its mark says <span>"
    );
    error.mockRestore();
  });
});
