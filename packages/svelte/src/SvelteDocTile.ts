// Adapted from react-wordgard's ReactDocTile.ts (by way of vue-wordgard's VueDocTile.ts) for
// Svelte: the renderer for our DocTile. No Svelte template draws the document (helpers/dom.ts):
// the document's list is drawn when its shape changed, then the nodes whose cells got a view, and
// Svelte decorations are components mounted on their own (helpers/mountRoot.ts). It all runs in
// `flushSync`, so their effects (the content attachments) run before the tiles are built.
import { flushSync, getAbortSignal } from "svelte";
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import {
  type ChildView,
  type HostedRenderer,
  RefusedUpdate,
  RenderedDocTile,
  RenderedWordgard,
  type RendererContext,
  createDocTile,
  editorOf,
  hostDocTile,
} from "@stesura/wordgard-view";
import { type DrawContext, type DrawnList, destroyPart } from "./components/ChildNodeViews.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { drawDirty } from "./components/nodes/DefaultNodeView.js";
import { DecorationKey } from "./contexts/DecorationContext.js";
import { DocumentKey, EditorKey } from "./contexts/EditorContext.js";
import { WrappedKey } from "./contexts/WrappedContext.js";
import { svelteNodeWrappers } from "./decorations/SvelteNodeWrapper.js";
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

const redrawsAll = (before: GardState, after: GardState) =>
  before.facet(svelteNodeWrappers.reader) != after.facet(svelteNodeWrappers.reader);

// A hosted editor's document, which WordgardDoc claims as it's set up and
// attaches once mounted, with its contexts; `place` puts the editor in the
// page, before the document is drawn.
type HostedDoc = {
  readonly claim: () => () => void;
  readonly attach: (contexts: Map<unknown, unknown>, place: () => void) => () => void;
};

const docs = new WeakMap<Element, HostedDoc>();

export const svelteDoc = (dom: Element) => {
  const doc = docs.get(dom);
  if (!doc) throw new Error("This editor isn't hosted by WordgardEditor");
  return doc;
};

// What the document's components get: `contexts` (the app's, WordgardDoc's),
// the editor, and not those of a decoration the editor is drawn in (a
// sub-editor's).
const documentContexts = (wg: Wordgard, contexts: Map<unknown, unknown>) => {
  const found = new Map(contexts);
  found.set(EditorKey, editorOf(wg));
  found.set(DocumentKey, wg);
  found.set(DecorationKey, null);
  found.set(WrappedKey, null);
  return found;
};

// Each content element's drawing, for the tests (testing/drawing.ts).
export const drawings = new WeakMap<Element, () => DrawContext>();

const svelteRenderer = (
  dom: Element,
  { wg, failed }: RendererContext,
  mount: (() => void) | null
): HostedRenderer => {
  let failures = 0;
  let cleared = 0;
  let context: DrawContext = {
    doc: dom.ownerDocument,
    dirty: new Set(),
    nodes: new Set(),
    words: svelteWords,
    holder: createHolder(dom, svelteWords, () => drain()),
    wrappers: { current: null },
    contexts: documentContexts(wg, new Map()),
    failed: (error) => {
      failures++;
      failed(error);
    },
    settle: [],
    defer: (run) => {
      context.settle.push(run);
      if (scheduled) return;
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        later();
      });
    },
  };
  let views: readonly ChildView[] = [];
  // What was last drawn, null before the first draw and after a detach.
  let last: DrawnList | null = null;
  // Unmounts the document's components, leaving the content element empty.
  const clear = () => {
    last?.parts.forEach(destroyPart);
    dom.replaceChildren();
    last = null;
  };
  const refuse = () => {
    if (last && inReaction())
      throw new RefusedUpdate(
        "SvelteWordgard can't update from inside a Svelte effect, template, $derived or attachment: read the editor's layout from useEditorEffect, useEditorLayoutEffect or an event handler"
      );
  };
  // Runs what Svelte's effects left to do (content elements drawn, or the
  // components didn't mark), until nothing is left, and puts back roots Svelte
  // replaced. Not again from inside itself (its flushes change the DOM, which
  // Wordgard's observer may read).
  let settling = false;
  const drain = () => {
    if (settling) return;
    settling = true;
    try {
      while (context.settle.length) {
        const pending = context.settle.splice(0);
        flushSync(() => {
          // As a component's error: the document is drawn anew.
          for (const run of pending)
            try {
              run();
            } catch (error) {
              console.error(error);
              context.failed(error);
            }
        });
      }
    } finally {
      settling = false;
    }
  };
  const settle = () => {
    drain();
    context.holder.take();
  };
  // Outside the commit: never from inside an effect, where Svelte's flush
  // crashes, nor roots placed there (placing drains). Says whether it settled.
  let scheduled = false;
  const later = () => {
    if (inReaction()) return context.settle.length == 0;
    settle();
    return true;
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
  const setWrappers = (state: GardState) => {
    const wrappers = state.facet(svelteNodeWrappers.reader);
    if (context.wrappers.current && context.wrappers.current != wrappers)
      for (const part of context.nodes) context.dirty.add(part);
    context.wrappers.current = wrappers;
  };
  drawings.set(dom, () => context);
  if (mount) {
    let claims = 0;
    let attachments = 0;
    docs.set(dom, {
      claim: () => {
        claims++;
        return () => {
          claims--;
        };
      },
      // The editor's element and content element exist once: a second
      // WordgardDoc would move the first's element and draw the document twice
      // into one content element.
      attach: (contexts, place) => {
        if (claims > 1) throw new Error("This editor is already rendered by another WordgardDoc");
        place();
        const attachment = ++attachments;
        // What another WordgardDoc drew goes, with its contexts.
        if (last) clear();
        context = { ...context, contexts: documentContexts(wg, contexts) };
        const draw = () =>
          batch(() => {
            last = DocNodeView(dom, views, null, context);
          });
        try {
          // The editor is in the page already, for the components' effects:
          // what's drawn isn't an edit.
          if (wg instanceof RenderedWordgard) wg.observer.ignore(draw);
          else draw();
          mount();
        } catch (error) {
          clear();
          throw error;
        }
        // Unless another WordgardDoc has attached since.
        return () => {
          if (attachment == attachments) clear();
        };
      },
    });
  }
  return {
    // A hosted editor's first layout, drawn when WordgardDoc attaches.
    prepare: (state, first) => {
      setWrappers(state);
      views = first;
    },
    commit: (state, next, publish) =>
      batch(() => {
        setWrappers(state);
        // After an error, the document is drawn anew.
        if (failures != cleared) {
          cleared = failures;
          clear();
        }
        publish();
        views = next;
        last = DocNodeView(dom, views, last, context);
      }),
    batch,
    redrawsAll,
    settle: later,
    words: svelteWords,
  };
};

export class SvelteDocTile extends RenderedDocTile {
  static create = (state: GardState, dom: Element, wg: Wordgard) =>
    createDocTile(
      SvelteDocTile,
      (dom, context) => svelteRenderer(dom, context, null),
      state,
      dom,
      wg
    );

  // For an editor WordgardEditor hosts: drawn when WordgardDoc mounts, which
  // then calls `mount`.
  static host = (state: GardState, dom: Element, wg: Wordgard, mount: () => void) =>
    hostDocTile(
      SvelteDocTile,
      (dom, context) => svelteRenderer(dom, context, mount),
      state,
      dom,
      wg
    );
}
