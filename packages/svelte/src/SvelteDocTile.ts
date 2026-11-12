// Adapted from react-wordgard's ReactDocTile.ts (by way of vue-wordgard's VueDocTile.ts) for
// Svelte: the renderer for our DocTile. No Svelte template draws the document (helpers/dom.ts):
// the document's list is drawn when its shape changed, then the nodes whose cells got a view, and
// Svelte decorations are components mounted on their own (helpers/mountRoot.ts). It all runs in
// `flushSync`, so their effects (the content attachments) run before the tiles are built.
import { flushSync, getAbortSignal } from "svelte";
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import {
  RefusedUpdate,
  RenderedDocTile,
  type Renderer,
  type RendererContext,
  createDocTile,
  editorOf,
} from "@stesura/wordgard-view";
import { type DrawContext, type DrawnList, destroyPart } from "./components/ChildNodeViews.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { drawDirty } from "./components/nodes/DefaultNodeView.js";
import { EditorKey } from "./contexts/EditorContext.js";
import { createHolder } from "./helpers/mountRoot.js";
import { svelteWords } from "./words.js";

// Whether Svelte is running an effect, a template, a `$derived` or an
// attachment: `getAbortSignal` throws outside one. Svelte 5.57 crashes on a
// `flushSync` from some of those, and would draw the document from inside its
// own update.
const inReaction = () => {
  try {
    getAbortSignal();
    return true;
  } catch {
    return false;
  }
};

const svelteRenderer = (dom: Element, { wg, failed }: RendererContext): Renderer => {
  let failures = 0;
  let cleared = 0;
  const contexts = new Map<unknown, unknown>([[EditorKey, editorOf(wg)]]);
  const context: DrawContext = {
    doc: dom.ownerDocument,
    dirty: new Set(),
    words: svelteWords,
    holder: createHolder(dom, svelteWords),
    contexts,
    failed: (error) => {
      failures++;
      failed(error);
    },
    settle: [],
  };
  let last: DrawnList | null = null;
  const refuse = () => {
    if (last && inReaction())
      throw new RefusedUpdate(
        "SvelteWordgard can't update from inside a Svelte effect, template, $derived or attachment: read the editor's layout from useEditorEffect, useEditorLayoutEffect or an event handler"
      );
  };
  // Runs what Svelte's effects left to do (content elements the components
  // didn't mark), until nothing is left, and puts back roots Svelte replaced.
  const settle = () => {
    while (context.settle.length) {
      const pending = context.settle.splice(0);
      flushSync(() => {
        for (const run of pending) run();
      });
    }
    context.holder.take();
  };
  // Svelte's flush runs every pending effect of the page, the app's too: only
  // when the document holds components, whose effects (attachments) must run
  // before the tiles are built.
  const batch = (change: () => void) => {
    refuse();
    change();
    drawDirty(context.dirty);
    if (!context.holder.mounted()) return;
    flushSync();
    settle();
  };
  return {
    commit: (_state, views, publish) =>
      batch(() => {
        // After an error, the document is drawn anew.
        if (failures != cleared) {
          cleared = failures;
          last?.parts.forEach(destroyPart);
          dom.replaceChildren();
          last = null;
        }
        publish();
        last = DocNodeView(dom, views, last, context);
      }),
    batch,
    redrawsAll: () => false,
    words: svelteWords,
  };
};

export class SvelteDocTile extends RenderedDocTile {
  static create = (state: GardState, dom: Element, wg: Wordgard) =>
    createDocTile(SvelteDocTile, svelteRenderer, state, dom, wg);

  static host = (): RenderedDocTile => {
    throw new Error("svelte-wordgard can't host an editor yet");
  };
}
