// Adapted from react-wordgard's WordgardEditor.browser.test.tsx and useEditorField.browser.test.tsx
// for Vue: an editor in the app's components (WordgardEditor, WordgardDoc), and the composables
// over it. Components outside the document render in Vue's next tick, not inside the editor's
// update: the tests wait for it. StrictMode and WordgardScope have no Vue counterpart.
import {
  type App,
  type Component,
  type ComponentOptions,
  computed,
  createApp,
  defineComponent,
  getCurrentInstance,
  h,
  inject,
  nextTick,
  onErrorCaptured,
  onMounted,
  onUpdated,
  provide,
  ref,
  watch,
} from "vue";
import { Leaf, Plot } from "wordgard/doc";
import { Decoration, Widget, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, bulletList, image } from "wordgard/schema";
import { GardState, Transaction } from "wordgard/state";
import { Blockquote, Heading, Image, Paragraph, Strong } from "wordgard/types";

import { docTileOf, drawing } from "../../../src/testing/tiles.js";
import { VueDocTile } from "../VueDocTile.js";
import { WordgardDoc } from "../components/WordgardDoc.js";
import { NodeContent } from "../components/NodeContent.js";
import { WordgardEditor } from "../components/WordgardEditor.js";
import { createShape } from "../decorations/VueShapeType.js";
import { createWidgetTypeWithRender } from "../decorations/VueWidgetType.js";
import { useEditorEffect } from "../hooks/useEditorEffect.js";
import { useEditorEventListener } from "../hooks/useEditorEventListener.js";
import { useEditorField, useEditorFieldEntry } from "../hooks/useEditorField.js";
import { useEditorLayoutEffect } from "../hooks/useEditorLayoutEffect.js";
import { useEditorState } from "../hooks/useEditorState.js";
import { useWordgard } from "../hooks/useWordgard.js";
import { watchRenders } from "../testing/renders.js";

const img = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

// An inline plot, which Wordgard draws between two `wg-buffer` images.
const Chip = Plot.define("Chip", {
  inline: true,
  inlineContent: true,
  shape: { element: "span", attributes: { class: "chip" } },
  parseRules: [{ selector: "span.chip" }],
});

const label = (text: string) =>
  Object.assign(document.createElement("span"), { className: "w", textContent: text });
const LabelView = defineComponent({
  props: ["value"],
  template: `<span class="w">{{ value }}</span>`,
});
const VueLabel = createWidgetTypeWithRender({ render: label, component: LabelView });
const NativeLabel = Widget.define<string>({ render: label });

// Marks, an image, a line break, a link and an inline plot, with Vue and
// native widgets.
const doc =
  `<p>plain <em>em</em> <strong>bold <a href="https://x.example">link</a></strong> <img src="${img}"> and<br>break</p>` +
  '<p>a <span class="chip">chip <em>b</em></span> c</p><p></p>';
const config: GardState.Extension = [
  basicSchema(),
  image(),
  GardState.schemaElement.of(Chip),
  Decoration.Tag.widget(Paragraph, "start", VueLabel.of("|")),
  Decoration.Tag.widget(Paragraph, "end", NativeLabel.of("¶")),
];

const imageSize = document.createElement("style");
imageSize.textContent = "img[src] { width: 20px; height: 20px; }";
document.head.appendChild(imageSize);

const containers: HTMLElement[] = [];
const apps: App[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const container of containers.splice(0)) container.remove();
});

const container = () => {
  const dom = document.createElement("div");
  dom.style.cssText = "position: absolute; left: 0; top: 0; width: 300px;";
  document.body.appendChild(dom);
  containers.push(dom);
  return dom;
};

// The editor a component is drawn under, for the test to drive.
const editors: Wordgard[] = [];
const Grab = defineComponent(() => {
  editors.push(useWordgard());
  return () => null;
});

const mount = (root: Component) => {
  editors.length = 0;
  const app = createApp(root);
  apps.push(app);
  app.mount(container());
  const wg = editors.at(-1);
  if (!wg) throw new Error("No editor");
  return { wg, app };
};

// The document's editor, with `probes` before its WordgardDoc.
const hosted = (probes: Component[] = [], extra: GardState.Extension = []) =>
  mount(
    defineComponent({
      components: { WordgardEditor, WordgardDoc, Grab },
      setup: () => ({ doc, config: [config, extra], probes }),
      template: `
        <WordgardEditor :doc="doc" :config="config">
          <Grab />
          <component v-for="(probe, i) in probes" :key="i" :is="probe" />
          <WordgardDoc class="host" />
        </WordgardEditor>`,
    })
  );

const plain = (extra: GardState.Extension = []) => {
  const wg = Wordgard.create({ doc, config: [config, extra], parent: container() });
  wg.flush();
  return wg;
};

// Effects run in a microtask when the editor is idle; components outside the
// document render in Vue's tick; frames bring Wordgard's own flushes.
const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const settle = async () => {
  await nextTick();
  await tick();
};
const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const edit = (wg: Wordgard, spec: Transaction.Spec) => {
  wg.dispatch(spec);
  wg.flush();
};

const steps: Transaction.Spec[] = [
  { changes: { from: 9, insert: [Leaf.text("x")] } },
  { changes: { from: 2, insert: [Image.of(`${img}#2`)] } },
  { changes: { from: 1, to: 12, add: Strong } },
  {
    changes: {
      from: 0,
      insert: [Paragraph.create([Leaf.text("new "), Leaf.text("one", [Strong])])],
    },
  },
  // Across the mark boundary in the new paragraph.
  { changes: { from: 2, to: 6 } },
];

// Takes the errors of the components in its slot.
const caught: string[] = [];
const Catch = defineComponent((_, { slots }) => {
  onErrorCaptured((error) => {
    caught.push(error instanceof Error ? error.message : String(error));
    return false;
  });
  return () => slots.default?.();
});

describe("WordgardEditor", () => {
  beforeEach(() => {
    caught.length = 0;
  });

  it("draws the document in the app's components as Wordgard draws it", () => {
    const { wg } = hosted();
    expect(wg.connected).toBe(true);
    expect(wg.contentDOM.wgTile).toBeInstanceOf(VueDocTile);
    expect(wg.dom.parentElement?.className).toBe("host");
    expect(drawing(wg)).toEqual(drawing(plain()));
  });

  it("keeps matching Wordgard through edits", () => {
    const { wg } = hosted();
    const reference = plain();
    for (const spec of steps) {
      edit(wg, spec);
      edit(reference, spec);
      expect(drawing(wg)).toEqual(drawing(reference));
    }
  });

  it("connects widgets once, when the editor is in the page", () => {
    const run = (draw: (extra: GardState.Extension) => Wordgard) => {
      const log: string[] = [];
      const Tracked = createWidgetTypeWithRender({
        render: label,
        component: LabelView,
        connect: (value) => log.push(`connect ${value}`),
        disconnect: (value) => log.push(`disconnect ${value}`),
      });
      const wg = draw(Decoration.Tag.widget(Paragraph, "after", Tracked.of("t")));
      log.push("|");
      edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("x")])] } });
      return log;
    };
    expect(run((extra) => hosted([], extra).wg)).toEqual(run(plain));
  });

  it("draws the document again when WordgardDoc is mounted again", async () => {
    const on = ref(true);
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab },
        setup: () => ({ doc, config, on }),
        template: `
          <WordgardEditor :doc="doc" :config="config">
            <Grab />
            <WordgardDoc v-if="on" />
          </WordgardEditor>`,
      })
    );
    on.value = false;
    await nextTick();
    expect(wg.connected).toBe(false);
    expect(wg.contentDOM.childNodes.length).toBe(0);
    on.value = true;
    await nextTick();
    expect(wg.connected).toBe(true);
    const reference = plain();
    expect(drawing(wg)).toEqual(drawing(reference));
    edit(wg, steps[0] ?? {});
    edit(reference, steps[0] ?? {});
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("refuses a second WordgardDoc for one editor", () => {
    mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab, Catch },
        setup: () => ({ doc, config }),
        template: `
          <WordgardEditor :doc="doc" :config="config">
            <Grab />
            <Catch><WordgardDoc /><WordgardDoc /></Catch>
          </WordgardEditor>`,
      })
    );
    // Both: neither can tell which came first.
    expect(caught).toEqual([
      expect.stringMatching(/already rendered by another WordgardDoc/),
      expect.stringMatching(/already rendered by another WordgardDoc/),
    ]);
  });

  it("refuses a WordgardDoc added for an editor already rendered", async () => {
    const second = ref(false);
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab, Catch },
        setup: () => ({ doc, config, second }),
        template: `
          <WordgardEditor :doc="doc" :config="config">
            <Grab />
            <WordgardDoc class="first" />
            <Catch><WordgardDoc v-if="second" /></Catch>
          </WordgardEditor>`,
      })
    );
    second.value = true;
    await nextTick();
    expect(caught).toEqual([expect.stringMatching(/already rendered by another WordgardDoc/)]);
    expect(wg.dom.parentElement?.className).toBe("first");
  });

  it("gives the document's components the host's provides, which may change outside the flush", async () => {
    const Themed = defineComponent({
      props: ["value"],
      setup: () => ({ theme: inject("theme"), frame: inject("frame", "none") }),
      template: `<span class="w">{{ theme }}:{{ frame }}:{{ value }}</span>`,
    });
    const ThemedLabel = createWidgetTypeWithRender({ render: label, component: Themed });
    const theme = ref("light");
    // Between WordgardEditor and WordgardDoc: what WordgardDoc's place sees.
    const Frame = defineComponent((_, { slots }) => {
      provide("frame", "framed");
      return () => slots.default?.();
    });
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab, Frame },
        setup: () => {
          provide("theme", theme);
          return {
            config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", ThemedLabel.of("x"))],
          };
        },
        template: `
          <WordgardEditor doc="<p>a<strong>b</strong></p>" :config="config">
            <Grab />
            <Frame><WordgardDoc /></Frame>
          </WordgardEditor>`,
      })
    );
    const widget = wg.contentDOM.querySelector(".w");
    expect(widget?.textContent).toBe("light:framed:x");
    const tile = docTileOf(wg);
    theme.value = "dark";
    await nextTick();
    wg.flush();
    expect(wg.contentDOM.querySelector(".w")).toBe(widget);
    expect(widget?.textContent).toBe("dark:framed:x");
    expect(docTileOf(wg)).toBe(tile);
  });

  // Vue's render() runs every pending callback of Vue's, the app's included,
  // unless Vue is already running them: WordgardDoc draws the document from
  // its onMounted, where it is. On the app's mount, the document's own
  // callbacks run a tick later; on an update, after WordgardDoc's.
  const callbacks = async (shown: boolean) => {
    const log: string[] = [];
    const probe = (name: string) =>
      defineComponent(() => {
        const element = ref<HTMLElement | null>(null);
        onMounted(() => log.push(`${name} ${element.value?.isConnected}`));
        return () => h("i", { ref: element });
      });
    const Widgeted = defineComponent({
      props: ["value"],
      setup: () => {
        const element = ref<HTMLElement | null>(null);
        onMounted(() => log.push(`widget ${element.value?.isConnected}`));
        return { element };
      },
      template: `<span ref="element" class="w">{{ value }}</span>`,
    });
    const Mounted = createWidgetTypeWithRender({ render: label, component: Widgeted });
    const show = ref(shown);
    const Before = probe("before");
    const After = probe("after");
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab, Before, After },
        setup: () => ({
          config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", Mounted.of("m"))],
          show,
        }),
        template: `
          <WordgardEditor doc="<p>a</p>" :config="config">
            <Grab />
            <template v-if="show"><Before /><WordgardDoc /><After /></template>
          </WordgardEditor>`,
      })
    );
    const mounted = [...log];
    show.value = true;
    await settle();
    expect(wg.connected).toBe(true);
    return { mounted, settled: log };
  };

  it("draws the document on the app's mount, the app's callbacks in their order", async () => {
    const { mounted, settled } = await callbacks(true);
    expect(mounted).toEqual(["before true", "after true"]);
    expect(settled).toEqual(["before true", "after true", "widget true"]);
  });

  it("draws the document on an update, the app's callbacks in their order", async () => {
    const { mounted, settled } = await callbacks(false);
    expect(mounted).toEqual([]);
    expect(settled).toEqual(["before true", "after true", "widget true"]);
  });

  it("takes the editor out of the page while a <Transition> leaves, and back", async () => {
    const on = ref(true);
    let left = () => {};
    const leave = (_: Element, done: () => void) => {
      left = done;
    };
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab },
        setup: () => ({ doc, config, on, leave }),
        template: `
          <WordgardEditor :doc="doc" :config="config">
            <Grab />
            <Transition :css="false" @leave="leave">
              <WordgardDoc v-if="on" class="leaving" />
            </Transition>
          </WordgardEditor>`,
      })
    );
    on.value = false;
    await nextTick();
    // Still leaving: the element is in the page, the editor isn't.
    expect(document.querySelector(".leaving")).not.toBeNull();
    expect(wg.connected).toBe(false);
    wg.dispatch(steps[0] ?? {});
    await frame();
    left();
    on.value = true;
    await nextTick();
    wg.flush();
    const reference = plain();
    edit(reference, steps[0] ?? {});
    expect(drawing(wg)).toEqual(drawing(reference));
    edit(wg, steps[1] ?? {});
    edit(reference, steps[1] ?? {});
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("draws the document anew where a WordgardDoc moves, with the new place's provides", async () => {
    const Placed = defineComponent({
      props: ["value"],
      setup: () => ({ place: inject("place"), state: useEditorState() }),
      template: `<span class="w">{{ place }}:{{ state.doc.content.length }}</span>`,
    });
    const PlacedLabel = createWidgetTypeWithRender({ render: label, component: Placed });
    const Place = defineComponent({
      props: ["name"],
      setup(props: { name: string }, { slots }) {
        provide("place", props.name);
        return () => slots.default?.();
      },
    });
    const first = ref(true);
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab, Place },
        setup: () => ({
          config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", PlacedLabel.of("x"))],
          first,
        }),
        template: `
          <WordgardEditor doc="<p>a</p>" :config="config">
            <Grab />
            <Place name="b"><WordgardDoc v-if="!first" class="b" /></Place>
            <Place name="a"><WordgardDoc v-if="first" class="a" /></Place>
          </WordgardEditor>`,
      })
    );
    expect(wg.contentDOM.querySelector(".w")?.textContent).toBe("a:1");
    first.value = false;
    await nextTick();
    expect(wg.dom.parentElement?.className).toBe("b");
    expect(wg.connected).toBe(true);
    expect(wg.contentDOM.querySelector(".w")?.textContent).toBe("b:1");
    // The widgets commit inside the flush, as the document's components do.
    edit(wg, { changes: { from: 3, insert: [Paragraph.create([Leaf.text("q")])] } });
    expect([...wg.contentDOM.querySelectorAll(".w")].map((w) => w.textContent)).toEqual([
      "b:2",
      "b:2",
    ]);
  });

  it("leaves nothing drawn when a WordgardDoc whose document threw goes", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const Throwing = defineComponent({
      props: ["value"],
      setup: () => {
        throw new Error("widget");
      },
      template: `<span />`,
    });
    const Thrown = createWidgetTypeWithRender({ render: label, component: Throwing });
    const on = ref(true);
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab, Catch },
        setup: () => ({
          config: [
            basicSchema(),
            Decoration.Tag.widget(Paragraph, "start", Thrown.of("x")),
            Decoration.Tag.widget(Paragraph, "end", VueLabel.of("y")),
          ],
          on,
        }),
        template: `
          <WordgardEditor doc="<p>a</p>" :config="config">
            <Grab />
            <Catch><WordgardDoc v-if="on" /></Catch>
          </WordgardEditor>`,
      })
    );
    expect(caught).toEqual(["widget"]);
    expect(wg.contentDOM.childNodes.length).toBe(0);
    on.value = false;
    await nextTick();
    expect(wg.contentDOM.childNodes.length).toBe(0);
    error.mockRestore();
  });
});

describe("renders", () => {
  // What each update rendered again, in order: a node's view by its node's
  // name, other components by their `name`.
  const updated: string[] = [];
  const counting: ComponentOptions = {
    beforeUpdate: () => {
      const instance = getCurrentInstance();
      const node = Reflect.get(Reflect.get(instance?.props.cell ?? {}, "view") ?? {}, "node");
      const name = node instanceof Plot || node instanceof Leaf ? node.name : instance?.type.name;
      if (name) updated.push(name);
    },
  };
  const editor = (html: string, extra: GardState.Extension = []) => {
    editors.length = 0;
    const app = createApp({
      components: { WordgardEditor, WordgardDoc, Grab },
      setup: () => ({ html, config: [basicSchema(), blockquote(), bulletList(), extra] }),
      template: `
        <WordgardEditor :doc="html" :config="config">
          <Grab />
          <WordgardDoc />
        </WordgardEditor>`,
    });
    app.mixin(counting);
    apps.push(app);
    app.mount(container());
    const wg = editors.at(-1);
    if (!wg) throw new Error("No editor");
    return wg;
  };
  const renders = (wg: Wordgard, spec: Transaction.Spec) => {
    const rendered = watchRenders(wg.contentDOM);
    updated.length = 0;
    edit(wg, spec);
    return rendered();
  };
  // Drawn as plain Wordgard draws the same state.
  const asWordgard = (wg: Wordgard) => {
    const reference = Wordgard.create({ state: wg.state, parent: container() });
    reference.flush();
    // `drawing` compares the tiles too, quadratic in a list's length.
    expect(wg.contentDOM.innerHTML).toBe(reference.contentDOM.innerHTML);
  };
  const text = (at: number) => ({ changes: { from: at, insert: [Leaf.text("x")] } });

  it("renders only the block typed in and its ancestors, from the first keystroke", () => {
    const wg = editor(
      "<p>one</p><blockquote><p>two</p></blockquote><ul><li><p>three</p></li></ul>"
    );
    const typed = (from: number) => renders(wg, text(from)).nodes.map((node) => node.name);
    expect(typed(16)).toEqual(["BulletList", "ListItem", "Paragraph"]);
    expect(typed(17)).toEqual(["BulletList", "ListItem", "Paragraph"]);
    expect(typed(8)).toEqual(["Blockquote", "Paragraph"]);
    expect(typed(2)).toEqual(["Paragraph"]);
    expect(
      wg.state.doc.content.map((node) => (node instanceof Plot ? node.textContent() : ""))
    ).toEqual(["oxne", "txwo", "txxhree"]);
  });

  it("renders no list but the text's for a keystroke, and the lists whose shape changes", () => {
    const wg = editor("<p>one</p><blockquote><p>two</p><p>three</p></blockquote><p>four</p>");
    const lists = (spec: Transaction.Spec) => renders(wg, spec).lists;
    expect(lists(text(2))).toBe(1);
    expect(lists(text(9))).toBe(1);
    // A paragraph more in the blockquote: its list, not the document's.
    expect(lists({ changes: { from: 7, insert: [Paragraph.create([Leaf.text("new")])] } })).toBe(2);
    expect(lists({ changes: { from: 0, insert: [Paragraph.create([Leaf.text("top")])] } })).toBe(2);
    expect(wg.contentDOM.textContent).toBe("topoxnenewtxwothreefour");
  });

  it("renders the paragraph typed in among 5,000, and every paragraph once for a change to all", () => {
    const html = Array.from({ length: 5000 }, (_, i) => `<p>paragraph ${i}</p>`).join("");
    const wg = editor(html);
    const middle = wg.state.doc.content.slice(0, 2500).reduce((sum, node) => sum + node.length, 4);
    const typed = renders(wg, text(middle));
    expect(typed.nodes.map((node) => node.name)).toEqual(["Paragraph"]);
    expect(typed.lists).toBe(1);
    const typedIn = wg.state.doc.content[2500];
    expect(typedIn instanceof Plot ? typedIn.textContent() : "").toBe("parxagraph 2500");
    renders(wg, { changes: { from: 0, to: wg.state.doc.length, add: Strong } });
    expect(updated).toEqual(Array(5000).fill("Paragraph"));
    asWordgard(wg);
  });

  it("renders parents first, each component once", () => {
    const Quote = defineComponent({
      name: "Quote",
      props: ["nodeProps"],
      components: { NodeContent },
      setup: () => ({ state: useEditorState() }),
      template: `<NodeContent :data-length="state.doc.length" />`,
    });
    const wg = editor("<blockquote><p>a</p><p>b</p></blockquote>", [
      Decoration.Tag.shape(Blockquote, createShape(Quote)),
    ]);
    renders(wg, text(2));
    expect(updated).toEqual(["Blockquote", "Quote", "Paragraph"]);
    expect(wg.contentDOM.textContent).toBe("xab");
  });

  it("draws a node whose shape turns into a native widget's and back", () => {
    const setPreview = Transaction.Effect.define<number | null>();
    const preview = GardState.Field.define<number | null>({
      create: () => null,
      update: (value, tr) => {
        for (const effect of tr.effects) if (effect.is(setPreview)) value = effect.value;
        return value;
      },
    });
    const wg = editor("<p>a</p><p>b</p><blockquote><p>c</p><p>d</p></blockquote>", [
      preview,
      Decoration.Point.source.of((state) => {
        const at = state.field(preview);
        return Decoration.Point.set(
          at === null ? [] : [[Decoration.Point.shape(NativeLabel.of("preview")), at]]
        );
      }),
    ]);
    // At the top, then in the blockquote.
    for (const at of [3, 10]) {
      edit(wg, { effects: setPreview.of(at) });
      asWordgard(wg);
      edit(wg, { effects: setPreview.of(null) });
      asWordgard(wg);
    }
  });

  it("draws typing in a plot inserted twice, the same object", () => {
    const wg = editor("<p>z</p>");
    const quote = Blockquote.create([
      Blockquote.create([
        Paragraph.create([Leaf.text("one")]),
        Paragraph.create([Leaf.text("two")]),
      ]),
      Paragraph.create([Leaf.text("three")]),
    ]);
    edit(wg, { changes: { from: 0, insert: [quote, quote] } });
    asWordgard(wg);
    const second = () => wg.state.doc.content[0]?.length ?? 0;
    for (const at of [() => 3, () => second() + 3, () => 11, () => second() + 5]) {
      edit(wg, text(at()));
      asWordgard(wg);
    }
  });

  it("draws typing in a node retagged with its content kept", () => {
    const wg = editor("<h1>abc</h1><p>z</p>");
    edit(wg, { changes: { from: 0, to: 1, insert: [Heading.of(2)] } });
    asWordgard(wg);
    edit(wg, text(2));
    asWordgard(wg);
  });
});

describe("composables", () => {
  it("useEditorState gives the flushed state, and a computed over it changes with it", async () => {
    const states: GardState[] = [];
    const blocks: number[] = [];
    const typed: string[] = [];
    const Whole = defineComponent(() => {
      const state = useEditorState();
      const wg = useWordgard();
      onUpdated(() => typed.push(wg.contentDOM.textContent ?? ""));
      return () => {
        states.push(state.value);
        return null;
      };
    });
    const Blocks = defineComponent(() => {
      const state = useEditorState();
      const count = computed(() => state.value.doc.content.length);
      return () => {
        blocks.push(count.value);
        return null;
      };
    });
    const { wg } = hosted([Whole, Blocks]);
    expect(states).toEqual([wg.state]);
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("Q")] } });
    await nextTick();
    expect(states).toHaveLength(1);
    wg.flush();
    await nextTick();
    expect(states.at(-1)).toBe(wg.state);
    expect(typed.at(-1)).toContain("Qplain");
    edit(wg, { selection: { anchor: 3 } });
    await nextTick();
    expect(states).toHaveLength(3);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    await nextTick();
    expect(blocks).toEqual([3, 4]);
  });

  it("runs the watchers of components outside the document after the flush, where they may dispatch", async () => {
    const seen: number[] = [];
    const Watcher = defineComponent(() => {
      const wg = useWordgard();
      const state = useEditorState();
      watch(state, (state) => {
        seen.push(state.doc.content.length);
        if (state.doc.content.length == 4) wg.dispatch({ selection: { anchor: 1 } });
      });
      return () => null;
    });
    const { wg } = hosted([Watcher]);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    await nextTick();
    expect(seen).toEqual([4]);
    wg.flush();
    expect(wg.state.selection.from).toBe(1);
  });

  it("useEditorEffect runs once the DOM is up to date, and may dispatch", async () => {
    const seen: (string | null)[] = [];
    const Probe = defineComponent(() => {
      const state = useEditorState();
      useEditorEffect((wg) => {
        // Tiles over the new DOM, and the editor in the page.
        seen.push(wg.domAtPos(1, 1).node.textContent);
        if (state.value.doc.content.length == 4) wg.dispatch({ selection: { anchor: 2 } });
      }, state);
      return () => null;
    });
    // Before WordgardDoc: its first effect waits for the editor to be drawn.
    const { wg } = hosted([Probe]);
    expect(seen).toEqual([]);
    await tick();
    expect(seen).toEqual(["plain "]);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("xy")])] } });
    await settle();
    expect(seen.at(-1)).toBe("xy");
    expect(wg.contentDOM.firstElementChild?.textContent).toBe("|xy¶");
    wg.flush();
    expect(wg.state.selection.from).toBe(2);
  });

  it("useEditorEffect, mounted while the editor is idle, may dispatch and read layout", async () => {
    const lefts: number[] = [];
    const show = ref(false);
    const Late = defineComponent(() => {
      useEditorEffect((wg) => {
        wg.dispatch({ changes: { from: 1, insert: [Leaf.text("z")] } });
        lefts.push(wg.coordsAtPos(2).left);
      });
      return () => null;
    });
    const Toggle = defineComponent(() => () => (show.value ? h(Late) : null));
    const { wg } = hosted([Toggle]);
    const reference = plain();
    show.value = true;
    await settle();
    expect(lefts).toHaveLength(1);
    edit(reference, { changes: { from: 1, insert: [Leaf.text("z")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("useEditorEffect runs after a flush that an update listener follows with a dispatch", async () => {
    const seen: number[] = [];
    const Probe = defineComponent(() => {
      const state = useEditorState();
      const blocks = computed(() => state.value.doc.content.length);
      useEditorEffect(() => {
        seen.push(blocks.value);
      }, blocks);
      return () => null;
    });
    // Moves the selection after every document change: `wg.state` is then
    // ahead of what the DOM shows, until the next flush.
    const follow = Wordgard.updateListener.of((update) => {
      if (update.docChanged) update.editor.dispatch({ selection: { anchor: 1 } });
    });
    const { wg } = hosted([Probe], follow);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    // Outside the document, the state comes after the flush, and the effect
    // after the one the listener's dispatch asked for.
    await settle();
    expect(seen.at(-1)).toBe(3);
    await frame();
    expect(seen.at(-1)).toBe(4);
  });

  it("useEditorEffect cleans up and runs again when its source changes", async () => {
    const log: string[] = [];
    const Probe = defineComponent(() => {
      const state = useEditorState();
      const blocks = computed(() => state.value.doc.content.length);
      useEditorEffect(() => {
        const count = blocks.value;
        log.push(`run ${count}`);
        return () => log.push(`clean ${count}`);
      }, blocks);
      return () => null;
    });
    const { wg, app } = hosted([Probe]);
    await tick();
    edit(wg, { changes: { from: 1, insert: [Leaf.text("x")] } });
    await settle();
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    await settle();
    app.unmount();
    apps.length = 0;
    expect(log).toEqual(["run 3", "clean 3", "run 4", "clean 4"]);
  });

  it("useEditorLayoutEffect writes on the same paint as the document update", () => {
    const reads: number[] = [];
    // A widget showing the height of the paragraph it starts.
    const Height = defineComponent({
      props: ["value"],
      setup() {
        const height = ref(0);
        useEditorLayoutEffect({
          read: (wg) => {
            const height = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
            reads.push(height);
            return height;
          },
          write: (value) => {
            height.value = value;
          },
        });
        return { height };
      },
      template: `<span class="h">{{ value }}{{ height }}</span>`,
    });
    const HeightLabel = createWidgetTypeWithRender({ render: label, component: Height });
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab },
        setup: () => ({
          config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", HeightLabel.of("h"))],
        }),
        template: `
          <WordgardEditor doc="<p>one</p>" :config="config">
            <Grab />
            <WordgardDoc />
          </WordgardEditor>`,
      })
    );
    wg.flush();
    const first = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
    expect(wg.contentDOM.querySelector(".h")?.textContent).toBe(`h${first}`);
    const tile = docTileOf(wg);
    edit(wg, { changes: { from: 4, insert: [Leaf.text(" two".repeat(40))] } });
    const second = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
    expect(second).toBeGreaterThan(first);
    expect(wg.contentDOM.querySelector(".h")?.textContent).toBe(`h${second}`);
    expect(reads.at(-1)).toBe(second);
    expect(docTileOf(wg)).not.toBe(tile);
  });

  it("useEditorLayoutEffect skips the write when every read returns undefined", () => {
    const writes: number[] = [];
    // Writes the paragraph count, only when it changed since the last write.
    const Count = defineComponent(() => {
      let last = -1;
      useEditorLayoutEffect({
        read: (wg) => {
          const count = wg.contentDOM.children.length;
          return count == last ? undefined : count;
        },
        write: (count) => {
          last = count;
          writes.push(count);
        },
      });
      return () => null;
    });
    const { wg } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab, Count },
        setup: () => ({ config: [basicSchema()] }),
        template: `
          <WordgardEditor doc="<p>one</p>" :config="config">
            <Grab />
            <Count />
            <WordgardDoc />
          </WordgardEditor>`,
      })
    );
    wg.flush();
    expect(writes).toEqual([1]);
    const schedule = vi.spyOn(wg, "scheduleDOMWrite");
    edit(wg, { changes: { from: 2, insert: [Leaf.text("x")] } });
    expect(writes).toEqual([1]);
    expect(schedule).not.toHaveBeenCalled();
    // A new paragraph: written in the same flush.
    edit(wg, { changes: { from: wg.state.doc.length, insert: [Paragraph.create()] } });
    expect(writes).toEqual([1, 2]);
    expect(schedule).toHaveBeenCalledTimes(1);
    schedule.mockRestore();
  });

  it("useEditorEventListener listens beside the document, while mounted", async () => {
    const heard: string[] = [];
    const show = ref(true);
    const Listener = defineComponent(() => {
      useEditorEventListener("keydown", (_, event) => {
        heard.push(event.key);
      });
      return () => null;
    });
    const Toggle = defineComponent(() => () => (show.value ? h(Listener) : null));
    const { wg } = hosted([Toggle]);
    const keydown = (key: string) =>
      wg.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    keydown("a");
    show.value = false;
    await nextTick();
    keydown("b");
    expect(heard).toEqual(["a"]);
  });

  // React refuses an update from inside its render or commit; Vue's render()
  // would run the app's pending callbacks before the app is patched.
  it("refuses to update from inside a component's hook, with an error saying why", async () => {
    const errors: string[] = [];
    const count = ref(0);
    const Probe = defineComponent(() => {
      const wg = useWordgard();
      onUpdated(() => {
        wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } });
        try {
          wg.coordsAtPos(1);
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      });
      return () => h("i", count.value);
    });
    const { wg } = hosted([Probe]);
    const reference = plain();
    count.value++;
    await nextTick();
    expect(errors).toEqual([expect.stringMatching(/can't update from inside a Vue component/)]);
    // Wordgard's next frame catches up.
    await frame();
    await frame();
    edit(reference, { changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("catches up on an update refused in one block after an edit in another", async () => {
    const count = ref(0);
    const Probe = defineComponent(() => {
      const wg = useWordgard();
      onUpdated(() => {
        wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } });
        expect(() => wg.coordsAtPos(1)).toThrow(/can't update from inside a Vue component/);
      });
      return () => h("i", count.value);
    });
    const { wg } = hosted([Probe]);
    const reference = plain();
    // Where the second paragraph's text starts.
    const second = (wg: Wordgard) => (wg.state.doc.content[0]?.length ?? 0) + 1;
    edit(wg, { changes: { from: second(wg), insert: [Leaf.text("y")] } });
    count.value++;
    await nextTick();
    edit(wg, { changes: { from: second(wg) + 1, insert: [Leaf.text("z")] } });
    await frame();
    await frame();
    edit(reference, { changes: { from: second(reference), insert: [Leaf.text("yz")] } });
    edit(reference, { changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
    expect(wg.state.doc.eq(reference.state.doc)).toBe(true);
  });

  it("selects through the state the composables read", async () => {
    const Selection = defineComponent(() => {
      const state = useEditorState();
      return () => h("output", state.value.selection.from);
    });
    const { wg } = hosted([Selection]);
    edit(wg, { selection: { anchor: 4 } });
    await nextTick();
    expect(document.querySelector("output")?.textContent).toBe("4");
  });
});

describe("useEditorField", () => {
  const bump = Transaction.Effect.define<string>();

  // A counter changed by an effect only: typing leaves it as it was.
  const counter = GardState.Field.define<number>({
    create: () => 0,
    update: (value, tr) => value + tr.effects.filter((effect) => effect.is(bump)).length,
  });

  // Entries keyed by the effect's value, each a new object when bumped.
  const entries = GardState.Field.define<ReadonlyMap<string, { readonly n: number }>>({
    create: () => new Map(),
    update: (value, tr) => {
      let next: Map<string, { readonly n: number }> | null = null;
      for (const effect of tr.effects) {
        if (!effect.is(bump)) continue;
        next ??= new Map(value);
        next.set(effect.value, { n: (next.get(effect.value)?.n ?? 0) + 1 });
      }
      return next ?? value;
    },
  });

  // The document's length, recomputed on doc changes; the same number keeps its identity.
  const length = GardState.Field.Derived.define((state) => state.doc.length);

  const renders: Record<string, unknown[]> = {};
  const log = (name: string, value: unknown) => (renders[name] ??= []).push(value);
  const probe = (name: string, read: () => { value: unknown }) =>
    defineComponent(() => {
      const value = read();
      return () => {
        log(name, value.value);
        return null;
      };
    });

  it("renders again on its own field's change only", async () => {
    const Count = probe("count", () => useEditorField(counter));
    const Parity = probe("parity", () => useEditorField(counter, (n) => n % 2));
    const Length = probe("length", () => useEditorField(length));
    const Entry = (id: string) =>
      probe(`entry:${id}`, () => {
        const entry = useEditorFieldEntry(entries, id);
        return computed(() => entry.value?.n);
      });
    const { wg: a } = mount(
      defineComponent({
        components: { WordgardEditor, WordgardDoc, Grab },
        setup: () => ({
          config: [basicSchema(), counter, entries, length.extension],
          probes: [Count, Parity, Entry("x"), Entry("y"), Length],
        }),
        template: `
          <WordgardEditor doc="<p>a</p>" :config="config">
            <Grab />
            <component v-for="(probe, i) in probes" :key="i" :is="probe" />
            <WordgardDoc />
          </WordgardEditor>`,
      })
    );
    const run = async (spec: Transaction.Spec) => {
      a.dispatch(spec);
      a.flush();
      await nextTick();
    };
    const counts = () => Object.fromEntries(Object.entries(renders).map(([k, v]) => [k, v.length]));
    const start = counts();

    // A selection change: no field changes, nothing renders.
    await run({ selection: { anchor: 2 } });
    expect(counts()).toEqual(start);

    // Typing: only the derived length changes.
    await run({ changes: { from: 1, insert: [Leaf.text("!")] } });
    expect(renders["length"]?.at(-1)).toBe(a.state.doc.length);
    expect(counts()).toEqual({ ...start, length: (start["length"] ?? 0) + 1 });

    // A bump of x: the counter, the parity and entry x, not entry y.
    const before = counts();
    await run({ effects: bump.of("x") });
    expect(renders["count"]?.at(-1)).toBe(1);
    expect(renders["parity"]?.at(-1)).toBe(1);
    expect(renders["entry:x"]?.at(-1)).toBe(1);
    expect(counts()["entry:y"]).toBe(before["entry:y"]);
    expect(counts()["length"]).toBe(before["length"]);

    // Two bumps of y: parity selects the same value and doesn't render.
    const mid = counts();
    await run({ effects: [bump.of("y"), bump.of("y")] });
    expect(renders["count"]?.at(-1)).toBe(3);
    expect(counts()["parity"]).toBe(mid["parity"]);
    expect(renders["entry:y"]?.at(-1)).toBe(2);
    expect(counts()["entry:x"]).toBe(mid["entry:x"]);
  });
});
