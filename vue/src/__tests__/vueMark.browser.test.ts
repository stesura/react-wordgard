// Adapted from react-wordgard's reactMark.browser.test.tsx for Vue: Vue marks, with templates.
// After each change, Wordgard's next flush must find nothing to redraw, and the tiles must be what
// a fresh editor builds.
import { computed, defineComponent, nextTick, onMounted, ref } from "vue";
import { Leaf, type Mark } from "wordgard/doc";
import { Decoration, Widget, type Wordgard } from "wordgard/editor";
import { basicSchema, color, image } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Color, Link } from "wordgard/types";

import { composeIn, drawn, flushKeeps, textIn, typeInto } from "../../../src/testing/editing.js";
import { VueWordgard } from "../VueWordgard.js";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { NodeContent } from "../components/NodeContent.js";
import { createMarkShape } from "../decorations/VueMarkType.js";
import { useEditorState } from "../hooks/useEditorState.js";
import { useWordgard } from "../hooks/useWordgard.js";

// What the components start with, and their controls, by editor, in the order
// they mount.
const initial = { icon: true, boxed: false };
type Control = {
  setIcon: (on: boolean) => Promise<void>;
  setTitle: (title: string) => Promise<void>;
  setBoxed: (on: boolean) => Promise<void>;
  getPos: () => number;
  mark: () => Mark;
};
const controls = new Map<Wordgard, Control[]>();

const setter =
  <T>(state: { value: T }) =>
  async (value: T) => {
    state.value = value;
    await nextTick();
  };

// A link: an icon shown from its own state, a title from its own state, and
// the content in `span.text`, or in `span.box > b` when boxed (Vue remounts the
// content in the `b`).
const LinkView = defineComponent({
  props: ["markProps"],
  components: { DecorationRoot, NodeContent },
  setup(props) {
    const wg = useWordgard();
    const icon = ref(initial.icon);
    const title = ref("a");
    const boxed = ref(initial.boxed);
    onMounted(() => {
      const control: Control = {
        setIcon: setter(icon),
        setTitle: setter(title),
        setBoxed: setter(boxed),
        getPos: props.markProps.getPos,
        mark: () => props.markProps.mark,
      };
      controls.set(wg, [...(controls.get(wg) ?? []), control]);
    });
    return { icon, title, boxed };
  },
  template: `
    <DecorationRoot :href="String(markProps.mark.value)" :title="title">
      <i v-if="icon" class="icon">^</i>
      <span v-if="boxed" class="box"><NodeContent as="b" /></span>
      <NodeContent v-else as="span" class="text" />
    </DecorationRoot>`,
});

// Content in its root, no chrome.
const ColorView = defineComponent({
  props: ["markProps"],
  components: { NodeContent },
  template: `<NodeContent class="color" :data-color="markProps.mark.value" />`,
});

const connected = { native: 0 };
const NativeMark = Widget.define<null>({
  render: () => Object.assign(document.createElement("span"), { className: "native" }),
  connect: () => connected.native++,
  disconnect: () => connected.native--,
});

// Chrome from the editor state: a marker while the cursor is in "bc", as a
// link's toolbar would show.
const CursorView = defineComponent({
  props: ["markProps"],
  components: { DecorationRoot, NodeContent },
  setup() {
    const state = useEditorState();
    const here = computed(() => {
      const { from } = state.value.selection;
      return from > 2 && from < 4;
    });
    return { here };
  },
  template: `
    <DecorationRoot class="cursor">
      <i v-if="here" class="here">*</i>
      <NodeContent as="span" />
    </DecorationRoot>`,
});

const linkConfig = (extra: GardState.Extension = []) => [
  basicSchema(),
  image(),
  Decoration.Mark.shape(Link, createMarkShape(LinkView, { element: "a" })),
  extra,
];

const editors: VueWordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  controls.clear();
  connected.native = 0;
  Object.assign(initial, { icon: true, boxed: false });
});

const create = (spec: { doc?: string; state?: GardState; config?: GardState.Extension } = {}) => {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const wg = spec.state
    ? VueWordgard.create({ state: spec.state, parent })
    : VueWordgard.create({
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
  const found = controls.get(wg)?.[index];
  if (!found) throw new Error("No link drawn");
  return found;
};

const icon = '<i class="icon" contenteditable="false">^</i>';

describe("Vue marks", () => {
  it("draws the component around the marked content, with the document's mark", () => {
    const wg = create();
    expect(wg.contentDOM.innerHTML).toBe(
      `<p>a<a href="x" title="a">${icon}<span class="text">bc</span></a>d</p>`
    );
    expect(control(wg).getPos()).toBe(2);
    expect(control(wg).mark().type).toBe(Link);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the tiles right when the component changes its chrome on its own", async () => {
    const wg = create();
    await control(wg).setIcon(false);
    await Promise.resolve();
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
    expect(flushKeeps(wg)).toBe(true);
    await control(wg).setIcon(true);
    expect(flushKeeps(wg)).toBe(true);
    initial.icon = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("keeps the attributes the component sets on its own", async () => {
    const wg = create();
    await control(wg).setTitle("b");
    expect(flushKeeps(wg)).toBe(true);
    expect(wg.contentDOM.querySelector("a")?.title).toBe("b");
  });

  it("takes the user's typing in its content, with the chrome changing before the flush", async () => {
    const wg = create();
    typeInto(wg, textIn(wg, "a .text"), 1, "x");
    await control(wg).setIcon(false);
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.icon = false;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("follows content Vue remounts in another element", async () => {
    const wg = create();
    await control(wg).setBoxed(true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("a .box b")?.textContent).toBe("bc");
    expect(flushKeeps(wg)).toBe(true);
    typeInto(wg, textIn(wg, "a .box b"), 1, "x");
    wg.flush();
    expect(String(wg.state.doc)).toContain("bxc");
    initial.boxed = true;
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("moves the widgets of content Vue remounts, drawn and connected once", async () => {
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
    await control(wg).setBoxed(true);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("a .box")?.innerHTML).toBe(`<b>b${native}c</b>`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    initial.boxed = true;
    expect(drawn(wg)).toEqual(fresh(wg));
    // The fresh editor connected a widget of its own.
    connected.native--;
    initial.boxed = false;
    await control(wg).setBoxed(false);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("a .text")?.innerHTML).toBe(`b${native}c`);
    expect(connected.native).toBe(1);
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // The gate's "a composition inside a Vue mark".
  it("keeps a composition in its content while the chrome changes", async () => {
    const wg = create();
    const sel = document.getSelection();
    const node = textIn(wg, "a .text");
    const composition = composeIn(wg, node);
    composition.update(1, "-");
    wg.flush();
    await control(wg).setIcon(false);
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
    wg.dispatch({
      changes: { from: 2, to: 4, insert: [Leaf.text("bc", [Link.of("y")])] },
    });
    wg.flush();
    expect(wg.contentDOM.querySelector("a")?.getAttribute("href")).toBe("y");
    // The same component, or one Vue mounted for the new mark.
    expect(controls.get(wg)?.at(-1)?.mark().value).toBe("y");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("turns an attribute-shaped mark into a wrapper", () => {
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
    expect(wg.contentDOM.querySelector(".here")?.getAttribute("contenteditable")).toBe("false");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  // Wordgard resolves positions through a mark's elements: a `v-if`'s comment
  // there would shift them.
  it("refuses a v-if's comment among a mark's elements", () => {
    const Anchored = defineComponent({
      props: ["markProps"],
      components: { NodeContent },
      template: `<span><i v-if="false">*</i><NodeContent as="span" /></span>`,
    });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() =>
      create({ config: [basicSchema(), Decoration.Mark.shape(Link, createMarkShape(Anchored))] })
    ).toThrow(/A Vue mark holds an empty text node or a comment beside its content/);
    error.mockRestore();
  });

  it("says when the component's root isn't the mark's element", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const Anchor = defineComponent({
      props: ["markProps"],
      components: { NodeContent },
      template: `<NodeContent as="a" />`,
    });
    create({
      config: [basicSchema(), Decoration.Mark.shape(Link, createMarkShape(Anchor))],
    });
    expect(error.mock.calls.flat().join("")).toContain(
      "A Vue mark's component drew <a> where its mark says <span>"
    );
    error.mockRestore();
  });
});
