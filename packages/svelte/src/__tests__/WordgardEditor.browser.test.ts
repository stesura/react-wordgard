// Adapted from vue-wordgard's WordgardEditor.browser.test.ts (itself from react-wordgard's
// WordgardEditor and useEditorField tests) for Svelte: an editor in the app's components
// (WordgardEditor, WordgardDoc), and the hooks over it. Components outside the document update
// after the editor's flush, in Svelte's next microtask: the tests wait for it. Where Vue's counted
// its components' renders, these count Svelte's effects, and the DOM an update touches.
import { type Component, flushSync, mount, unmount } from "svelte";
import { Leaf, Plot } from "wordgard/doc";
import { Decoration, Widget, Wordgard } from "wordgard/editor";
import { basicSchema, blockquote, bulletList, image } from "wordgard/schema";
import { GardState, Transaction } from "wordgard/state";
import { Blockquote, Heading, Image, Paragraph, Strong } from "wordgard/types";

import { tick } from "../testing/tick.js";
import { drawn } from "../../../../test/editing.js";
import { docTileOf, drawing } from "../../../../test/tiles.js";
import { SvelteDocTile } from "../SvelteDocTile.js";
import { SvelteWordgard } from "../SvelteWordgard.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetTypeWithRender } from "../decorations/SvelteWidgetType.js";
import { type Box, box } from "../helpers/box.svelte.js";
import Callout from "./fixtures/Callout.svelte";
import { alive, reset } from "./fixtures/controls.js";
import Added from "./fixtures/editor/Added.svelte";
import Blocks from "./fixtures/editor/Blocks.svelte";
import BlocksEffect from "./fixtures/editor/BlocksEffect.svelte";
import Callbacks from "./fixtures/editor/Callbacks.svelte";
import Caught from "./fixtures/editor/Caught.svelte";
import Cleaning from "./fixtures/editor/Cleaning.svelte";
import CountedQuote from "./fixtures/editor/CountedQuote.svelte";
import Effect from "./fixtures/editor/Effect.svelte";
import Fields from "./fixtures/editor/Fields.svelte";
import Height from "./fixtures/editor/Height.svelte";
import Host from "./fixtures/editor/Host.svelte";
import Label from "./fixtures/editor/Label.svelte";
import Late from "./fixtures/editor/Late.svelte";
import Leaving from "./fixtures/editor/Leaving.svelte";
import Listener from "./fixtures/editor/Listener.svelte";
import LoggedLabel from "./fixtures/editor/LoggedLabel.svelte";
import Moving from "./fixtures/editor/Moving.svelte";
import Paragraphs from "./fixtures/editor/Paragraphs.svelte";
import PlacedLabel from "./fixtures/editor/PlacedLabel.svelte";
import Refused from "./fixtures/editor/Refused.svelte";
import ThemeHost from "./fixtures/editor/ThemeHost.svelte";
import Themed from "./fixtures/editor/Themed.svelte";
import Throwing from "./fixtures/editor/Throwing.svelte";
import Twice from "./fixtures/editor/Twice.svelte";
import Watcher from "./fixtures/editor/Watcher.svelte";
import Whole from "./fixtures/editor/Whole.svelte";
import { bumpField, counter, entries, length } from "./fixtures/editor/fields.js";
import { bump, grabbed, logOf, logged, resetProbes, toggle } from "./fixtures/editor/probes.js";

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
const SvelteLabel = createWidgetTypeWithRender({ render: label, component: Label });
const NativeLabel = Widget.define<string>({ render: label });

// Marks, an image, a line break, a link and an inline plot, with Svelte and
// native widgets.
const doc =
  `<p>plain <em>em</em> <strong>bold <a href="https://x.example">link</a></strong> <img src="${img}"> and<br>break</p>` +
  '<p>a <span class="chip">chip <em>b</em></span> c</p><p></p>';
const config: GardState.Extension = [
  basicSchema(),
  image(),
  GardState.schemaElement.of(Chip),
  Decoration.Tag.widget(Paragraph, "start", SvelteLabel.of("|")),
  Decoration.Tag.widget(Paragraph, "end", NativeLabel.of("¶")),
];

// A Svelte shape, for the tests on the document's components.
const calloutDoc = "<p>a</p><blockquote><p>bc</p></blockquote>";
const calloutConfig = [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, createShape(Callout).of("div")),
];

const imageSize = document.createElement("style");
imageSize.textContent = "img[src] { width: 20px; height: 20px; }";
document.head.appendChild(imageSize);

const apps: Record<string, unknown>[] = [];
const containers: HTMLElement[] = [];
afterEach(() => {
  for (const app of apps.splice(0)) void unmount(app);
  for (const container of containers.splice(0)) container.remove();
  resetProbes();
  reset();
});

const container = () => {
  const dom = document.createElement("div");
  dom.style.cssText = "position: absolute; left: 0; top: 0; width: 300px;";
  document.body.appendChild(dom);
  containers.push(dom);
  return dom;
};

// Mounts the app, its props read from `props` (a box the test may set), and
// gives the editor it hosts.
const start = <Props extends Record<string, unknown>>(
  component: Component<Props>,
  initial: Props
) => {
  const props = box(initial);
  const target = container();
  const app = mount(component, {
    target,
    props: new Proxy(initial, { get: (_, key) => Reflect.get(props.current, key) }),
  });
  apps.push(app);
  flushSync();
  const wg = grabbed.at(-1);
  if (!wg) throw new Error("No editor");
  return { wg, target, props, app };
};

// Sets some of the app's props, and lets Svelte update.
const set = <Props extends Record<string, unknown>>(props: Box<Props>, change: Partial<Props>) => {
  props.current = { ...props.current, ...change };
  flushSync();
};

// The document's editor, with `probes` before its WordgardDoc.
const hosted = (probes: Component[] = [], extra: GardState.Extension = []) =>
  start(Host, { doc, config: [config, extra], probes });

const plain = (extra: GardState.Extension = []) => {
  const wg = Wordgard.create({ doc, config: [config, extra], parent: container() });
  wg.flush();
  return wg;
};

// What a standalone SvelteWordgard draws for the same state.
const fresh = (wg: { state: SvelteWordgard["state"] }) => {
  const standalone = SvelteWordgard.create({ state: wg.state, parent: container() });
  standalone.flush();
  return drawn(standalone);
};

// Effects run in a microtask when the editor is idle; components outside the
// document update in Svelte's; frames bring Wordgard's own flushes.
const microtask = () => new Promise<void>((resolve) => queueMicrotask(resolve));
const settle = async () => {
  await tick();
  await microtask();
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

describe("WordgardEditor", () => {
  it("draws the document in the app's components as Wordgard draws it", () => {
    const { wg, target } = hosted();
    expect(wg.connected).toBe(true);
    expect(wg.contentDOM.wgTile).toBeInstanceOf(SvelteDocTile);
    expect(target.querySelector("div.editor")?.firstElementChild).toBe(wg.dom);
    expect(drawing(wg)).toEqual(drawing(plain()));
  });

  it("draws Svelte shapes in the app's components as a standalone editor does", () => {
    const { wg } = start(Host, { doc: calloutDoc, config: calloutConfig });
    expect(wg.contentDOM.innerHTML).toContain('<div class="body"><p>bc</p></div>');
    expect(drawn(wg)).toEqual(fresh(wg));
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
        component: Label,
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

  it("gives components outside the document the state after the flush", async () => {
    const { wg, target } = start(Host, { doc: calloutDoc, config: calloutConfig });
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("x")] } });
    await tick();
    // Not before the flush.
    expect(target.querySelector(".head")?.textContent).toBe("1");
    wg.dispatch({ selection: { anchor: 2 } });
    wg.flush();
    await tick();
    expect(target.querySelector(".head")?.textContent).toBe("2");
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("unmounts the document's components with WordgardDoc, and draws them again when it's back", () => {
    const { wg, props } = start(Host, { doc: calloutDoc, config: calloutConfig, show: true });
    expect(alive.get("callout")).toBe(1);
    set(props, { show: false });
    expect(alive.get("callout")).toBe(0);
    expect(wg.connected).toBe(false);
    expect(wg.dom.isConnected).toBe(false);
    expect(wg.contentDOM.childNodes.length).toBe(0);
    set(props, { show: true });
    expect(wg.connected).toBe(true);
    expect(alive.get("callout")).toBe(1);
    expect(drawn(wg)).toEqual(fresh(wg));
    edit(wg, { changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(drawn(wg)).toEqual(fresh(wg));
  });

  it("unmounts the document's components with the app", () => {
    start(Host, { doc: calloutDoc, config: calloutConfig });
    expect(alive.get("callout")).toBe(1);
    for (const app of apps.splice(0)) void unmount(app);
    expect(alive.get("callout")).toBe(0);
  });

  it("refuses a second WordgardDoc for one editor", () => {
    start(Twice, { doc, config });
    expect(logOf("caught")).toEqual([
      expect.stringMatching(/already rendered by another WordgardDoc/),
    ]);
  });

  it("refuses a WordgardDoc added for an editor already rendered", () => {
    const { wg, props } = start(Added, { doc, config, second: false });
    set(props, { second: true });
    expect(logOf("caught")).toEqual([
      expect.stringMatching(/already rendered by another WordgardDoc/),
    ]);
    expect(wg.dom.parentElement?.className).toBe("first");
    expect(wg.connected).toBe(true);
    expect(drawing(wg)).toEqual(drawing(plain()));
  });

  it("gives the document's components the host's contexts, whose values may change outside the flush", () => {
    const ThemedLabel = createWidgetTypeWithRender({ render: label, component: Themed });
    const { wg, props } = start(ThemeHost, {
      doc: "<p>a<strong>b</strong></p>",
      config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", ThemedLabel.of("x"))],
      theme: "light",
    });
    const widget = wg.contentDOM.querySelector(".w");
    expect(widget?.textContent).toBe("light:framed:x");
    const tile = docTileOf(wg);
    set(props, { theme: "dark" });
    wg.flush();
    expect(wg.contentDOM.querySelector(".w")).toBe(widget);
    expect(widget?.textContent).toBe("dark:framed:x");
    expect(docTileOf(wg)).toBe(tile);
  });

  // WordgardDoc draws the document from its attachment, inside Svelte's
  // flush: the document's effects run there, between the app's.
  const callbacks = async (shown: boolean) => {
    const Logged = createWidgetTypeWithRender({ render: label, component: LoggedLabel });
    const { wg, props } = start(Callbacks, {
      doc: "<p>a</p>",
      config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", Logged.of("m"))],
      show: shown,
    });
    const mounted = [...logOf("callbacks")];
    set(props, { show: true });
    await settle();
    expect(wg.connected).toBe(true);
    return { mounted, settled: logOf("callbacks") };
  };

  it("draws the document on the app's mount, every component in the page in its effects", async () => {
    const { mounted, settled } = await callbacks(true);
    expect(mounted).toEqual(["before true", "widget true", "after true"]);
    expect(settled).toEqual(mounted);
  });

  it("draws the document on an update, every component in the page in its effects", async () => {
    const { mounted, settled } = await callbacks(false);
    expect(mounted).toEqual([]);
    expect(settled).toEqual(["before true", "widget true", "after true"]);
  });

  it("keeps the editor while an outro plays, and draws it anew when it's back", async () => {
    const { wg, props } = start(Leaving, { doc, config, on: true });
    set(props, { on: false });
    // Svelte destroys the block once its outro is done: the editor stays
    // drawn and in the page until then.
    expect(document.querySelector(".leaving")).not.toBeNull();
    expect(wg.connected).toBe(true);
    edit(wg, steps[0] ?? {});
    await vi.waitFor(() => expect(document.querySelector(".leaving")).toBeNull());
    expect(wg.connected).toBe(false);
    set(props, { on: true });
    const reference = plain();
    edit(reference, steps[0] ?? {});
    expect(drawing(wg)).toEqual(drawing(reference));
    edit(wg, steps[1] ?? {});
    edit(reference, steps[1] ?? {});
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("draws the document anew where a WordgardDoc moves, with the new place's contexts", () => {
    const Placed = createWidgetTypeWithRender({ render: label, component: PlacedLabel });
    const { wg, props } = start(Moving, {
      doc: "<p>a</p>",
      config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", Placed.of("x"))],
      first: true,
    });
    expect(wg.contentDOM.querySelector(".w")?.textContent).toBe("a:1");
    set(props, { first: false });
    expect(wg.dom.parentElement?.className).toBe("b");
    expect(wg.connected).toBe(true);
    expect(wg.contentDOM.querySelector(".w")?.textContent).toBe("b:1");
    // The widgets update inside the flush, as the document's components do.
    edit(wg, { changes: { from: 3, insert: [Paragraph.create([Leaf.text("q")])] } });
    expect([...wg.contentDOM.querySelectorAll(".w")].map((w) => w.textContent)).toEqual([
      "b:2",
      "b:2",
    ]);
  });

  it("leaves nothing drawn when a WordgardDoc whose document threw goes", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const Thrown = createWidgetTypeWithRender({ render: label, component: Throwing });
    const { wg, props } = start(Caught, {
      doc: "<p>a</p>",
      config: [
        basicSchema(),
        Decoration.Tag.widget(Paragraph, "start", Thrown.of("x")),
        Decoration.Tag.widget(Paragraph, "end", SvelteLabel.of("y")),
      ],
      on: true,
    });
    // A component throwing in its setup leaves no root: the drawing throws
    // that, and the component's own error is logged.
    expect(logOf("caught")).toEqual([expect.stringMatching(/must draw one element at its root/)]);
    await settle();
    expect(error).toHaveBeenCalledWith(new Error("widget"));
    expect(wg.contentDOM.childNodes.length).toBe(0);
    set(props, { on: false });
    expect(wg.contentDOM.childNodes.length).toBe(0);
    error.mockRestore();
  });
});

describe("renders", () => {
  const editor = (html: string, extra: GardState.Extension = []) =>
    start(Host, { doc: html, config: [basicSchema(), blockquote(), bulletList(), extra] }).wg;

  // The DOM an update changed: the elements whose children, text or
  // attributes changed, and the text nodes it wrote.
  const touched = (wg: Wordgard, spec: Transaction.Spec) => {
    const observer = new MutationObserver(() => {});
    observer.observe(wg.contentDOM, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
    });
    edit(wg, spec);
    const records = observer.takeRecords();
    observer.disconnect();
    return records;
  };
  // The blocks an update changed, by the closest block around each change.
  const blocks = (wg: Wordgard, spec: Transaction.Spec) => {
    const found = new Set<Element>();
    for (const { target } of touched(wg, spec)) {
      const element = target instanceof Element ? target : target.parentElement;
      const block = element?.closest("p, li, ul, blockquote, [contenteditable]");
      if (block) found.add(block);
    }
    return [...found];
  };
  // Drawn as plain Wordgard draws the same state.
  const asWordgard = (wg: Wordgard) => {
    const reference = Wordgard.create({ state: wg.state, parent: container() });
    reference.flush();
    // `drawing` compares the tiles too, quadratic in a list's length.
    expect(wg.contentDOM.innerHTML).toBe(reference.contentDOM.innerHTML);
  };
  const text = (at: number) => ({ changes: { from: at, insert: [Leaf.text("x")] } });
  const paragraphAt = (wg: Wordgard, pos: number) => {
    const { node } = wg.domAtPos(pos, 1);
    return (node instanceof Element ? node : node.parentElement)?.closest("p");
  };

  it("touches only the block typed in, from the first keystroke", () => {
    const wg = editor(
      "<p>one</p><blockquote><p>two</p></blockquote><ul><li><p>three</p></li></ul>"
    );
    for (const at of [16, 17, 8, 2]) {
      const typedIn = paragraphAt(wg, at);
      expect(blocks(wg, text(at))).toEqual([typedIn]);
    }
    expect(
      wg.state.doc.content.map((node) => (node instanceof Plot ? node.textContent() : ""))
    ).toEqual(["oxne", "txwo", "txxhree"]);
  });

  it("redraws no list but the text's for a keystroke, and the lists whose shape changes", () => {
    const wg = editor("<p>one</p><blockquote><p>two</p><p>three</p></blockquote><p>four</p>");
    // The elements whose children changed.
    const lists = (spec: Transaction.Spec) =>
      new Set(
        touched(wg, spec)
          .filter((record) => record.type == "childList")
          .map((record) => record.target)
      );
    const quote = () => wg.contentDOM.querySelector("blockquote");
    expect([...lists(text(2))].every((list) => list == paragraphAt(wg, 2))).toBe(true);
    expect([...lists(text(9))].every((list) => list == paragraphAt(wg, 9))).toBe(true);
    // A paragraph more in the blockquote: its list, not the document's.
    expect(lists({ changes: { from: 7, insert: [Paragraph.create([Leaf.text("new")])] } })).toEqual(
      new Set([quote()])
    );
    expect(lists({ changes: { from: 0, insert: [Paragraph.create([Leaf.text("top")])] } })).toEqual(
      new Set([wg.contentDOM])
    );
    expect(wg.contentDOM.textContent).toBe("topoxnenewtxwothreefour");
  });

  it("touches the paragraph typed in among 5,000, and every paragraph for a change to all", () => {
    const html = Array.from({ length: 5000 }, (_, i) => `<p>paragraph ${i}</p>`).join("");
    const wg = editor(html);
    const middle = wg.state.doc.content.slice(0, 2500).reduce((sum, node) => sum + node.length, 4);
    const typedIn = paragraphAt(wg, middle);
    expect(blocks(wg, text(middle))).toEqual([typedIn]);
    const typed = wg.state.doc.content[2500];
    expect(typed instanceof Plot ? typed.textContent() : "").toBe("parxagraph 2500");
    const paragraphs = [...wg.contentDOM.children];
    expect(blocks(wg, { changes: { from: 0, to: wg.state.doc.length, add: Strong } })).toEqual(
      paragraphs
    );
    asWordgard(wg);
  });

  it("runs a shape component's effect once an update", () => {
    const wg = editor("<blockquote><p>a</p><p>b</p></blockquote>", [
      Decoration.Tag.shape(Blockquote, createShape(CountedQuote)),
    ]);
    expect(logOf("quote")).toEqual([8]);
    edit(wg, text(2));
    expect(logOf("quote")).toEqual([8, 9]);
    expect(wg.contentDOM.querySelector("blockquote")?.getAttribute("data-length")).toBe("9");
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

describe("hooks", () => {
  it("useEditorState gives the flushed state, and a $derived over it changes with it", async () => {
    const { wg } = hosted([Whole, Blocks]);
    expect(logOf("states")).toEqual([wg.state]);
    wg.dispatch({ changes: { from: 1, insert: [Leaf.text("Q")] } });
    await tick();
    expect(logOf("states")).toHaveLength(1);
    wg.flush();
    await tick();
    expect(logOf("states").at(-1)).toBe(wg.state);
    expect(logOf("typed").at(-1)).toContain("Qplain");
    edit(wg, { selection: { anchor: 3 } });
    await tick();
    expect(logOf("states")).toHaveLength(3);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    await tick();
    expect(logOf("blocks")).toEqual([3, 4]);
  });

  it("runs the effects of components outside the document after the flush, where they may dispatch", async () => {
    const { wg } = hosted([Watcher]);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    await tick();
    expect(logOf("seen")).toEqual([3, 4]);
    wg.flush();
    expect(wg.state.selection.from).toBe(1);
  });

  it("useEditorEffect runs once the DOM is up to date, and may dispatch", async () => {
    // Before WordgardDoc: its first effect waits for the editor to be drawn.
    const { wg } = hosted([Effect]);
    expect(logOf("seen")).toEqual([]);
    await microtask();
    expect(logOf("seen")).toEqual(["plain "]);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("xy")])] } });
    await settle();
    expect(logOf("seen").at(-1)).toBe("xy");
    expect(wg.contentDOM.firstElementChild?.textContent).toBe("|xy¶");
    wg.flush();
    expect(wg.state.selection.from).toBe(2);
  });

  it("useEditorEffect, mounted while the editor is idle, may dispatch and read layout", async () => {
    const { wg } = start(Host, { doc, config, toggled: Late });
    const reference = plain();
    toggle.current = true;
    await settle();
    expect(logOf("lefts")).toHaveLength(1);
    edit(reference, { changes: { from: 1, insert: [Leaf.text("z")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("useEditorEffect runs after a flush that an update listener follows with a dispatch", async () => {
    // Moves the selection after every document change: `wg.state` is then
    // ahead of what the DOM shows, until the next flush.
    const follow = Wordgard.updateListener.of((update) => {
      if (update.docChanged) update.editor.dispatch({ selection: { anchor: 1 } });
    });
    const { wg } = hosted([BlocksEffect], follow);
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    // Outside the document, the state comes after the flush, and the effect
    // after the one the listener's dispatch asked for.
    await settle();
    expect(logOf("seen").at(-1)).toBe(3);
    await frame();
    expect(logOf("seen").at(-1)).toBe(4);
  });

  it("useEditorEffect cleans up and runs again when its source changes", async () => {
    const { wg, app } = hosted([Cleaning]);
    await microtask();
    edit(wg, { changes: { from: 1, insert: [Leaf.text("x")] } });
    await settle();
    edit(wg, { changes: { from: 0, insert: [Paragraph.create([Leaf.text("new")])] } });
    await settle();
    void unmount(app);
    apps.length = 0;
    expect(logOf("effect")).toEqual(["run 3", "clean 3", "run 4", "clean 4"]);
  });

  it("useEditorLayoutEffect writes on the same paint as the document update", () => {
    const HeightLabel = createWidgetTypeWithRender({ render: label, component: Height });
    const { wg } = start(Host, {
      doc: "<p>one</p>",
      config: [basicSchema(), Decoration.Tag.widget(Paragraph, "start", HeightLabel.of("h"))],
    });
    wg.flush();
    const first = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
    expect(wg.contentDOM.querySelector(".h")?.textContent).toBe(`h${first}`);
    const tile = docTileOf(wg);
    edit(wg, { changes: { from: 4, insert: [Leaf.text(" two".repeat(40))] } });
    const second = wg.contentDOM.firstElementChild?.getBoundingClientRect().height ?? 0;
    expect(second).toBeGreaterThan(first);
    expect(wg.contentDOM.querySelector(".h")?.textContent).toBe(`h${second}`);
    expect(logOf("reads").at(-1)).toBe(second);
    expect(docTileOf(wg)).not.toBe(tile);
  });

  it("useEditorLayoutEffect skips the write when every read returns undefined", () => {
    const { wg } = start(Host, {
      doc: "<p>one</p>",
      config: [basicSchema()],
      probes: [Paragraphs],
    });
    wg.flush();
    expect(logOf("writes")).toEqual([1]);
    const schedule = vi.spyOn(wg, "scheduleDOMWrite");
    edit(wg, { changes: { from: 2, insert: [Leaf.text("x")] } });
    expect(logOf("writes")).toEqual([1]);
    expect(schedule).not.toHaveBeenCalled();
    // A new paragraph: written in the same flush.
    edit(wg, { changes: { from: wg.state.doc.length, insert: [Paragraph.create()] } });
    expect(logOf("writes")).toEqual([1, 2]);
    expect(schedule).toHaveBeenCalledTimes(1);
    schedule.mockRestore();
  });

  it("useEditorEventListener listens beside the document, while mounted", () => {
    toggle.current = true;
    const { wg } = start(Host, { doc, config, toggled: Listener });
    const keydown = (key: string) =>
      wg.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    keydown("a");
    toggle.current = false;
    flushSync();
    keydown("b");
    expect(logOf("heard")).toEqual(["a"]);
  });

  it("refuses to update from inside a component's effect, with an error saying why", async () => {
    const { wg } = hosted([Refused]);
    const reference = plain();
    bump.current++;
    await tick();
    expect(logOf("errors")).toEqual([
      expect.stringMatching(/can't update from inside a Svelte effect/),
    ]);
    // Wordgard's next frame catches up.
    await frame();
    await frame();
    edit(reference, { changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
  });

  it("catches up on an update refused in one block after an edit in another", async () => {
    const { wg } = hosted([Refused]);
    const reference = plain();
    // Where the second paragraph's text starts.
    const second = (wg: Wordgard) => (wg.state.doc.content[0]?.length ?? 0) + 1;
    edit(wg, { changes: { from: second(wg), insert: [Leaf.text("y")] } });
    bump.current++;
    await tick();
    expect(logOf("errors")).toEqual([
      expect.stringMatching(/can't update from inside a Svelte effect/),
    ]);
    edit(wg, { changes: { from: second(wg) + 1, insert: [Leaf.text("z")] } });
    await frame();
    await frame();
    edit(reference, { changes: { from: second(reference), insert: [Leaf.text("yz")] } });
    edit(reference, { changes: { from: 1, insert: [Leaf.text("x")] } });
    expect(drawing(wg)).toEqual(drawing(reference));
    expect(wg.state.doc.eq(reference.state.doc)).toBe(true);
  });
});

describe("useEditorField", () => {
  it("runs again on its own field's change only", async () => {
    const { wg: a } = start(Host, {
      doc: "<p>a</p>",
      config: [basicSchema(), counter, entries, length.extension],
      probes: [Fields],
    });
    const run = async (spec: Transaction.Spec) => {
      a.dispatch(spec);
      a.flush();
      await tick();
    };
    const counts = () => Object.fromEntries(Object.entries(logged).map(([k, v]) => [k, v.length]));
    const atStart = counts();

    // A selection change: no field changes, nothing runs.
    await run({ selection: { anchor: 2 } });
    expect(counts()).toEqual(atStart);

    // Typing: only the derived length changes.
    await run({ changes: { from: 1, insert: [Leaf.text("!")] } });
    expect(logOf("length").at(-1)).toBe(a.state.doc.length);
    expect(counts()).toEqual({ ...atStart, length: (atStart["length"] ?? 0) + 1 });

    // A bump of x: the counter, the parity and entry x, not entry y.
    const before = counts();
    await run({ effects: bumpField.of("x") });
    expect(logOf("count").at(-1)).toBe(1);
    expect(logOf("parity").at(-1)).toBe(1);
    expect(logOf("entry:x").at(-1)).toBe(1);
    expect(counts()["entry:y"]).toBe(before["entry:y"]);
    expect(counts()["length"]).toBe(before["length"]);

    // Two bumps of y: parity selects the same value and doesn't run.
    const mid = counts();
    await run({ effects: [bumpField.of("y"), bumpField.of("y")] });
    expect(logOf("count").at(-1)).toBe(3);
    expect(counts()["parity"]).toBe(mid["parity"]);
    expect(logOf("entry:y").at(-1)).toBe(2);
    expect(counts()["entry:x"]).toBe(mid["entry:x"]);
  });
});
