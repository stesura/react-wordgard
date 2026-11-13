// Adapted from react-wordgard's replacedRoot browser test for Vue: a shape or widget whose component
// replaces its root element from its own state (another `:key`, which the contract advises
// against). The tiles are rebuilt over the new root before Wordgard reads them, as React's and
// Svelte's.
import { defineComponent, nextTick, ref } from "vue";
import { Decoration, type Wordgard } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import type { GardState } from "wordgard/state";
import { Blockquote } from "wordgard/types";

import { drawn, flushKeeps, textIn, typeInto } from "../../../../test/editing.js";
import { VueWordgard } from "../VueWordgard.js";
import { NodeContent } from "../components/NodeContent.js";
import { createShape } from "../decorations/VueShapeType.js";
import { createWidgetType } from "../decorations/VueWidgetType.js";

// The key every component starts with, and the setters.
const initial = { key: 0 };
const swaps: ((key: number) => Promise<void>)[] = [];

const Swapping = defineComponent({
  props: ["nodeProps"],
  components: { NodeContent },
  setup() {
    const key = ref(initial.key);
    swaps.push(async (next) => {
      key.value = next;
      await nextTick();
    });
    return { key };
  },
  template: `<div :key="key" :data-key="key"><NodeContent as="div" class="body" /></div>`,
});

const config = [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, createShape(Swapping)),
];

const editors: Wordgard[] = [];
afterEach(() => {
  for (const wg of editors.splice(0)) wg.dom.remove();
  swaps.length = 0;
  initial.key = 0;
});

const create = (spec: { doc?: string; state?: GardState }) => {
  const parent = document.body.appendChild(document.createElement("div"));
  const wg = spec.state
    ? VueWordgard.create({ state: spec.state, parent })
    : VueWordgard.create({ doc: spec.doc ?? "", config, parent });
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

const Badge = createWidgetType<null>({
  component: defineComponent({
    props: ["value"],
    setup() {
      const key = ref(initial.key);
      swaps.push(async (next) => {
        key.value = next;
        await nextTick();
      });
      return { key };
    },
    template: `<i :key="key" class="badge" :data-key="key" />`,
  }),
});

describe("A Vue shape replacing its root on its own", () => {
  it("has a widget's tile rebuilt over the new root", async () => {
    const parent = document.body.appendChild(document.createElement("div"));
    const widgets = [
      basicSchema(),
      Decoration.Point.source.of(() =>
        Decoration.Point.set([[Decoration.Point.widget(Badge.of(null)), 2]])
      ),
    ];
    const wg = VueWordgard.create({ doc: "<p>abc</p>", config: widgets, parent });
    wg.flush();
    editors.push(wg);
    const old = wg.contentDOM.querySelector("[data-key]");
    await swaps[0]?.(1);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("[data-key]")).not.toBe(old);
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg, 1));
    typeInto(wg, textIn(wg, "p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("axbc");
    expect(drawn(wg)).toEqual(fresh(wg, 1));
  });

  it("has its tiles rebuilt over the new root", async () => {
    const wg = create({ doc: "<p>a</p><blockquote><p>bc</p></blockquote>" });
    const old = wg.contentDOM.querySelector("[data-key]");
    await swaps[0]?.(1);
    await Promise.resolve();
    expect(wg.contentDOM.querySelector("[data-key]")).not.toBe(old);
    expect(flushKeeps(wg)).toBe(true);
    expect(drawn(wg)).toEqual(fresh(wg, 1));
    typeInto(wg, textIn(wg, ".body p"), 1, "x");
    wg.flush();
    expect(wg.state.doc.textContent()).toBe("a\nbxc");
    expect(drawn(wg)).toEqual(fresh(wg, 1));
  });
});
