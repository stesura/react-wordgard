// Not in react-wordgard, where React unmounts what it drew: svelte-wordgard mounts each Svelte
// decoration as a root of its own, which WordgardDoc's unmount must unmount, and Svelte's delegated
// events keep their targets until then. Many editors, torn down: nothing left mounted, listening
// or reachable.
import { flushSync, mount, unmount } from "svelte";
import { Decoration } from "wordgard/editor";
import { basicSchema, blockquote } from "wordgard/schema";
import { Blockquote, Link, Paragraph } from "wordgard/types";

import { createMarkShape } from "../decorations/SvelteMarkType.js";
import { nodeWrapper } from "../decorations/SvelteNodeWrapper.js";
import { createShape } from "../decorations/SvelteShapeType.js";
import { createWidgetType } from "../decorations/SvelteWidgetType.js";
import { createWrapper } from "../decorations/SvelteWrapperType.js";
import { drawingOf } from "../testing/drawing.js";
import Badge from "./fixtures/Badge.svelte";
import Callout from "./fixtures/Callout.svelte";
import Frame from "./fixtures/Frame.svelte";
import LeadWrapper from "./fixtures/LeadWrapper.svelte";
import LinkMark from "./fixtures/LinkMark.svelte";
import Plain from "./fixtures/Plain.svelte";
import { alive, reset } from "./fixtures/controls.js";
import { grabbed } from "./fixtures/editor/probes.js";
import App from "./fixtures/teardown/App.svelte";

const BadgeType = createWidgetType<string>({ component: Badge, element: "button" });

const doc = '<p>a <a href="https://x/">link</a></p><blockquote><p>b</p></blockquote>';
const config = [
  basicSchema(),
  blockquote(),
  Decoration.Tag.shape(Blockquote, createShape(Callout).of("div")),
  Decoration.Tag.wrapper(Paragraph, createWrapper(Frame, { element: "section" })),
  Decoration.Mark.shape(Link, createMarkShape(LinkMark, { element: "a" })),
  Decoration.Point.source.of(() =>
    Decoration.Point.set([[Decoration.Point.widget(BadgeType.of("!")), 1]])
  ),
  nodeWrapper(Blockquote, LeadWrapper),
];

afterEach(reset);

// An app drawing an editor, and how to tear both down.
const start = () => {
  const target = document.body.appendChild(document.createElement("div"));
  const app = mount(App, { target, props: { doc, config } });
  flushSync();
  // Not kept: the collection test needs every reference gone.
  const wg = grabbed.pop();
  if (!wg) throw new Error("No editor");
  return {
    wg,
    stop: () => {
      void unmount(app);
      flushSync();
      target.remove();
    },
  };
};

describe("WordgardDoc's unmount", () => {
  it("unmounts every component the document drew, leaving nothing listening", () => {
    for (let i = 0; i < 20; i++) {
      const { wg, stop } = start();
      const before = drawingOf(wg.contentDOM);
      const cells = before.nodes.map((part) => part.cell);
      expect(cells.length).toBeGreaterThan(2);
      expect(before.mounted).toBe(true);
      expect(alive.get("badge")).toBe(1);
      stop();
      const after = drawingOf(wg.contentDOM);
      expect(after.nodes).toEqual([]);
      expect(after.mounted).toBe(false);
      expect(after.holder.childNodes.length).toBe(0);
      expect(cells.filter((cell) => cell.listener)).toEqual([]);
      expect(alive.get("callout")).toBe(0);
      expect(alive.get("badge")).toBe(0);
      expect(wg.contentDOM.childNodes.length).toBe(0);
    }
  });

  // Chromium only: the `view-svelte` project starts it with `--expose-gc`.
  const gc: unknown = Reflect.get(globalThis, "gc");

  it.runIf(typeof gc == "function")("lets the editors be collected", async () => {
    // In a function of its own: nothing here keeps an editor once it returns.
    const track = () => {
      const refs: WeakRef<Element>[] = [];
      for (let i = 0; i < 10; i++) {
        const { wg, stop } = start();
        refs.push(new WeakRef(wg.contentDOM));
        stop();
      }
      reset();
      return refs;
    };
    const refs = track();
    // Svelte keeps its last flush's effects until the next: some other Svelte work releases them.
    void unmount(mount(Plain, { target: document.createElement("div"), props: { n: 1 } }));
    flushSync();
    // Not `deref()` between them: it keeps its target alive until the job ends.
    for (let i = 0; i < 10; i++) {
      if (typeof gc == "function") gc();
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(refs.map((ref, i) => (ref.deref() ? i : -1)).filter((i) => i >= 0)).toEqual([]);
  });
});
