// Adapted from react-wordgard's WordgardScope.browser.test.tsx for Vue: the composables under a
// WordgardScope use its editor and follow it, which setup running once makes a matter of
// subscriptions moving (EditorContext.ts's `followEditor`), and of where a component commits: inside
// the flush of the editor whose document it is in, after the flush of any other.
import {
  type App,
  type Component,
  type ShallowRef,
  computed,
  createApp,
  defineComponent,
  h,
  nextTick,
  onErrorCaptured,
  shallowRef,
  watch,
} from "vue";
import { Leaf } from "wordgard/doc";
import { Decoration, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import { GardState, Transaction } from "wordgard/state";
import { Blockquote, Paragraph } from "wordgard/types";

import { findEditor, listenersOf } from "@stesura/wordgard-view";
import { DecorationRoot } from "../components/DecorationRoot.js";
import { NodeContent } from "../components/NodeContent.js";
import { WordgardDoc } from "../components/WordgardDoc.js";
import { WordgardEditor } from "../components/WordgardEditor.js";
import { WordgardScope } from "../components/WordgardScope.js";
import { createShape } from "../decorations/VueShapeType.js";
import { createWidgetTypeWithRender } from "../decorations/VueWidgetType.js";
import { useEditorEffect } from "../hooks/useEditorEffect.js";
import { useEditorEventListener } from "../hooks/useEditorEventListener.js";
import { useEditorField } from "../hooks/useEditorField.js";
import { useEditorLayoutEffect } from "../hooks/useEditorLayoutEffect.js";
import { useEditorState } from "../hooks/useEditorState.js";
import { useWordgard, useWordgardRef } from "../hooks/useWordgard.js";

const containers: HTMLElement[] = [];
const apps: App[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  for (const container of containers.splice(0)) container.remove();
});

const container = () => {
  const dom = document.createElement("div");
  document.body.appendChild(dom);
  containers.push(dom);
  return dom;
};

const tick = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const settle = async () => {
  await nextTick();
  await tick();
};

const edit = (wg: Wordgard, spec: Transaction.Spec) => {
  wg.dispatch(spec);
  wg.flush();
};

const insert = (wg: Wordgard, text: string) =>
  edit(wg, { changes: { from: 1, insert: [Leaf.text(text)] } });

const editors = new Map<string, Wordgard>();
const editor = (name: string) => {
  const wg = editors.get(name);
  if (!wg) throw new Error(`No editor ${name}`);
  return wg;
};

const Grab = defineComponent({
  props: ["name"],
  setup: (props: { name: string }) => {
    editors.set(props.name, useWordgard());
    return () => null;
  },
});

// Which editor the widget in a's document scopes its probe to: a's own state, so the scope
// changes inside a's flush.
const choose = Transaction.Effect.define<string>();
const chosen = GardState.Field.define<string>({
  create: () => "a",
  update: (value, tr) => tr.effects.findLast((effect) => effect.is(choose))?.value ?? value,
});

// What the probes saw, rendered: `text` from the state, `wg` from useWordgardRef.
const seen: string[] = [];
const effects: string[] = [];
const events: string[] = [];
const reads: string[] = [];

const Probe = defineComponent(() => {
  const state = useEditorState();
  const wg = useWordgardRef();
  const text = computed(() => state.value.doc.textContent());
  useEditorEffect((editor) => {
    effects.push(editor.state.doc.textContent());
  });
  useEditorEventListener("keydown", (editor) => {
    events.push(editor.state.doc.textContent());
  });
  useEditorLayoutEffect({
    read: (editor) => {
      reads.push(editor.state.doc.textContent());
      return undefined;
    },
    write: () => {},
  });
  return () => {
    seen.push(`${text.value}:${wg.value.state.doc.textContent()}`);
    return h("output", text.value);
  };
});

// b is unmounted when `showB` is false.
const showB = shallowRef(true);

// a and b side by side, `Extra` in a's slot, set up after Grab: Vue sets a slot's components up
// after the slot renders.
const page = (
  Extra: Component | null,
  aConfig: GardState.Extension = [],
  bConfig: GardState.Extension = [],
  aDoc = "<p>a</p>"
) => {
  editors.clear();
  showB.value = true;
  const app = createApp(
    defineComponent(() => () => [
      h(WordgardEditor, { doc: aDoc, config: [basicSchema(), chosen, aConfig] }, () => [
        h(Grab, { name: "a" }),
        Extra && h(Extra),
        h(WordgardDoc, { class: "a" }),
      ]),
      showB.value &&
        h(WordgardEditor, { doc: "<p>b</p>", config: [basicSchema(), bConfig] }, () => [
          h(Grab, { name: "b" }),
          h(WordgardDoc, { class: "b" }),
        ]),
    ])
  );
  apps.push(app);
  app.mount(container());
  return app;
};

// `probe` under a scope giving the editor `name()` names.
const scoped = (name: () => string, probe: Component = Probe) =>
  defineComponent(() => () => h(WordgardScope, { wg: editor(name()) }, () => h(probe)));

// The probe beside a's document, scoped to `active`.
const besides = (active: ShallowRef<string>, probe: Component = Probe) =>
  page(scoped(() => active.value, probe));

// A Vue widget at the start of a's paragraphs, its element holding `component`.
const inDocument = (component: Component) => {
  const Root = defineComponent(() => () => h("span", [h(component)]));
  const Widget = createWidgetTypeWithRender({
    render: () => document.createElement("span"),
    component: Root,
  });
  return Decoration.Tag.widget(Paragraph, "start", Widget.of(null));
};

// A Vue shape for a's quotes, `component` in its chrome before the content.
const inShape = (component: Component) => {
  const Quote = defineComponent({
    props: ["nodeProps"],
    setup: () => () =>
      h(DecorationRoot, null, () => [h("aside", [h(component)]), h(NodeContent, { as: "div" })]),
  });
  return [blockquote(), Decoration.Tag.shape(Blockquote, createShape(Quote))];
};

const keydown = (wg: Wordgard) =>
  wg.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "x", bubbles: true }));

beforeEach(() => {
  seen.length = 0;
  effects.length = 0;
  events.length = 0;
  reads.length = 0;
});

describe("WordgardScope", () => {
  it("gives its composables the editor it names, and follows it", async () => {
    // Grab sets a before the scope's render reads it, and b once it renders: the probe starts on a.
    const active = shallowRef("a");
    besides(active);
    await settle();
    const a = editor("a");
    const b = editor("b");
    expect(seen.at(-1)).toBe("a:a");
    expect(effects).toEqual(["a"]);

    active.value = "b";
    await settle();
    expect(seen.at(-1)).toBe("b:b");
    expect(effects.at(-1)).toBe("b");
    keydown(b);
    keydown(a);
    expect(events).toEqual(["b"]);

    insert(b, "!");
    await settle();
    expect(seen.at(-1)).toBe("!b:!b");
    expect(reads.at(-1)).toBe("!b");
    const count = seen.length;
    insert(a, "?");
    await settle();
    expect(seen).toHaveLength(count);
    expect(reads.at(-1)).toBe("!b");

    active.value = "a";
    await settle();
    expect(seen.at(-1)).toBe("?a:?a");
    expect(effects.at(-1)).toBe("?a");
  });

  it("leaves nothing subscribed to the editors it left", async () => {
    const active = shallowRef("a");
    const app = besides(active);
    await settle();
    const a = findEditor(editor("a"));
    const b = findEditor(editor("b"));
    if (!a || !b) throw new Error("No editors");
    const before = { measures: a.measures.size, keys: listenersOf(a.wg, "keydown").length };
    active.value = "b";
    await settle();
    expect(a.measures.size).toBe(before.measures - 1);
    expect(listenersOf(a.wg, "keydown")).toHaveLength(before.keys - 1);
    expect(b.measures.size).toBe(1);
    expect(listenersOf(b.wg, "keydown")).toHaveLength(1);
    app.unmount();
    apps.length = 0;
    expect(b.measures.size).toBe(0);
    expect(listenersOf(b.wg, "keydown")).toHaveLength(0);
    const count = seen.length;
    insert(b.wg, "!");
    await settle();
    expect(seen).toHaveLength(count);
  });

  it("drops an update of the editor it left that was waiting for that editor's flush to end", async () => {
    // b's update listener flushes a, whose document switches the probe back to a: after b
    // published, before the probe's update for it runs.
    const back = Wordgard.updateListener.of((update) => {
      if (!update.docChanged) return;
      const a = editor("a");
      a.dispatch({ effects: choose.of("a") });
      a.flush();
    });
    const Chosen = defineComponent(() => {
      const name = useEditorField(chosen);
      // The same scope, its `wg` switching: not a new component per render.
      return () => h(WordgardScope, { wg: editor(name.value) }, () => h(Probe));
    });
    page(null, inDocument(Chosen), back);
    await settle();
    const a = editor("a");
    edit(a, { effects: choose.of("b") });
    expect(seen.at(-1)).toBe("b:b");
    insert(editor("b"), "!");
    await settle();
    expect(a.contentDOM.querySelector("output")?.textContent).toBe("a");
    expect(seen.at(-1)).toBe("a:a");
    expect(seen).not.toContain("!b:a");
  });

  it("drops an update of the editor it left that the editor's effects had already taken", async () => {
    const Chosen = defineComponent(() => {
      const name = useEditorField(chosen);
      return () => h(WordgardScope, { wg: editor(name.value) }, () => h(Probe));
    });
    page(null, inDocument(Chosen));
    await settle();
    const a = editor("a");
    const b = editor("b");
    edit(a, { effects: choose.of("b") });
    expect(seen.at(-1)).toBe("b:b");
    const bValue = findEditor(b);
    if (!bValue) throw new Error("No editor");
    // Waiting before the probe's update, which b's publish adds: it flushes a, whose document
    // switches the probe back to a, while b's effects run.
    b.dispatch({ changes: { from: 1, insert: [Leaf.text("!")] } });
    bValue.afterFlush(() => {
      a.dispatch({ effects: choose.of("a") });
      a.flush();
    });
    b.flush();
    await settle();
    expect(a.contentDOM.querySelector("output")?.textContent).toBe("a");
    expect(seen.at(-1)).toBe("a:a");
    expect(seen).not.toContain("!b:a");
  });

  it("switches to a destroyed editor without throwing, and back", async () => {
    const active = shallowRef("a");
    besides(active);
    await settle();
    insert(editor("b"), "!");
    showB.value = false;
    await settle();
    expect(editor("b").connected).toBe(false);
    active.value = "b";
    await settle();
    expect(seen.at(-1)).toBe("!b:!b");
    active.value = "a";
    await settle();
    expect(seen.at(-1)).toBe("a:a");
    expect(effects.at(-1)).toBe("a");
  });

  it("follows inside a shape of a's document, switching inside a's flush", async () => {
    const Chosen = defineComponent(() => {
      const name = useEditorField(chosen);
      // The same scope, its `wg` switching: not a new component per render.
      return () => h(WordgardScope, { wg: editor(name.value) }, () => h(Probe));
    });
    page(null, inShape(Chosen), [], "<blockquote><p>a</p></blockquote>");
    await settle();
    const a = editor("a");
    const b = editor("b");
    expect(a.contentDOM.querySelector("blockquote > aside output")?.textContent).toBe("a");
    edit(a, { effects: choose.of("b") });
    // Drawn in a's flush, with a's document.
    expect(a.contentDOM.querySelector("output")?.textContent).toBe("b");
    expect(seen.at(-1)).toBe("b:b");
    // b's updates reach it after b's flush, outside a's.
    insert(b, "!");
    expect(a.contentDOM.querySelector("output")?.textContent).toBe("b");
    await settle();
    expect(a.contentDOM.querySelector("output")?.textContent).toBe("!b");
    edit(a, { effects: choose.of("a") });
    expect(a.contentDOM.querySelector("output")?.textContent).toBe("a");
  });

  it("runs a watcher dispatching to the scope's editor after its flush, also from a's document", async () => {
    const errors: unknown[] = [];
    const Dispatching = defineComponent(() => {
      const state = useEditorState();
      const wg = useWordgardRef();
      watch(state, (state) => {
        if (state.doc.textContent() == "!b") wg.value.dispatch({ selection: { anchor: 2 } });
      });
      return () => null;
    });
    const Scoped = defineComponent(() => {
      const name = useEditorField(chosen);
      onErrorCaptured((error) => {
        errors.push(error);
        return false;
      });
      return () => h(WordgardScope, { wg: editor(name.value) }, () => h(Dispatching));
    });
    page(null, inDocument(Scoped));
    await settle();
    const a = editor("a");
    const b = editor("b");
    edit(a, { effects: choose.of("b") });
    const error = vi.spyOn(console, "error");
    try {
      insert(b, "!");
      await settle();
      b.flush();
      expect(b.state.selection.from).toBe(2);
      expect(errors).toEqual([]);
      expect(error).not.toHaveBeenCalled();
    } finally {
      error.mockRestore();
    }
  });

  it("warns in development when a component took the first editor with useWordgard", async () => {
    const Taker = defineComponent(() => {
      useWordgard();
      return () => null;
    });
    const active = shallowRef("a");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      besides(active, Taker);
      await settle();
      expect(warn).not.toHaveBeenCalled();
      active.value = "b";
      await settle();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toMatch(/useWordgardRef/);
    } finally {
      warn.mockRestore();
    }
  });

  it("refuses an editor vue-wordgard doesn't drive", () => {
    const plain = Wordgard.create({
      doc: "<p>x</p>",
      config: [basicSchema()],
      parent: container(),
    });
    const app = createApp(defineComponent(() => () => h(WordgardScope, { wg: plain })));
    apps.push(app);
    expect(() => app.mount(container())).toThrow(/WordgardEditor/);
  });

  it("refuses such an editor given later, in its render: the slot goes", async () => {
    const plain = Wordgard.create({
      doc: "<p>x</p>",
      config: [basicSchema()],
      parent: container(),
    });
    const target = shallowRef<Wordgard | null>(null);
    const errors: string[] = [];
    // An app error handler takes what a production build would log.
    page(
      defineComponent(() => {
        onErrorCaptured((error) => {
          errors.push(error instanceof Error ? error.message : String(error));
          return false;
        });
        return () => h(WordgardScope, { wg: target.value ?? editor("a") }, () => h(Probe));
      })
    );
    await settle();
    expect(document.querySelector("output")?.textContent).toBe("a");
    target.value = plain;
    await settle();
    expect(errors).toEqual([expect.stringMatching(/WordgardEditor/)]);
    expect(document.querySelector("output")).toBeNull();
  });
});
