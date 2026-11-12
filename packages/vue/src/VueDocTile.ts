// Adapted from react-wordgard's ReactDocTile.ts for Vue: Vue's renderer for our DocTile. Vue has
// no flushSync, but `render()` patches at once when the change comes from the root, as here: the
// document's list is drawn when its shape changed, then the components whose state the update
// changed commit (sync.ts), the nodes given new views by their cells among them.
import {
  type AppContext,
  type Component,
  type ComponentInternalInstance,
  type VNode,
  createApp,
  getCurrentInstance,
  h,
  render,
  shallowRef,
} from "vue";
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import {
  type ChildView,
  type HostedRenderer,
  RefusedUpdate,
  RenderedDocTile,
  type RendererContext,
  createDocTile,
  createNodeWrappers,
  editorOf,
  hostDocTile,
  shapeOf,
} from "@stesura/wordgard-view";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { ContentKey, WrappedKey } from "./contexts/ContentContext.js";
import { DecorationKey, DecorationRootKey } from "./contexts/DecorationContext.js";
import { EditorKey, NodeWrappersKey } from "./contexts/EditorContext.js";
import { vueNodeWrappers } from "./decorations/VueNodeWrapper.js";
import { flushUpdates, syncContext, syncMixin } from "./sync.js";
import { vueWords } from "./words.js";

// What WordgardDoc draws a hosted editor's document with: `attach` renders it
// from the host component and builds the tiles, returning what takes it away.
// Each WordgardDoc `claim`s the editor first, so `attach` can refuse a second
// one.
export type VueDoc = {
  readonly claim: () => () => void;
  readonly attach: (host: ComponentInternalInstance) => () => void;
};

const docs = new WeakMap<Element, VueDoc>();

export const vueDoc = (dom: Element) => {
  const doc = docs.get(dom);
  if (!doc) throw new Error("This editor isn't hosted by WordgardEditor");
  return doc;
};

const redrawsAll = (before: GardState, after: GardState) =>
  before.facet(vueNodeWrappers.reader) != after.facet(vueNodeWrappers.reader);

// A component's provides, which Vue's typings leave out.
const providesOf = (instance: ComponentInternalInstance) => {
  const provides: unknown = Reflect.get(instance, "provides");
  if (typeof provides != "object" || !provides) throw new Error("A component without provides");
  return provides;
};

// The app context of the document's top components, which have no component
// above them (DocNodeView's `adopt`): their provides chain to `provides` (the
// host component's, for a hosted editor), under the editor's own; the rest of
// `app`'s (global components, directives, properties) comes through, with the
// mixin committing in the flush and an error handler of its own. Vue caches
// each component's options merged with the mixins, by context: these get
// caches of their own.
const documentContext = (
  app: AppContext,
  provides: object,
  wg: Wordgard,
  wrappers: unknown,
  errorHandler: (thrown: unknown) => void
) => {
  const context: AppContext = Object.create(app);
  context.config = Object.create(app.config);
  context.config.errorHandler = errorHandler;
  context.mixins = [...app.mixins, syncMixin];
  context.provides = Object.create(provides);
  context.provides[EditorKey] = editorOf(wg);
  context.provides[NodeWrappersKey] = wrappers;
  // Not those of a decoration the host is drawn in (a sub-editor's).
  for (const key of [ContentKey, WrappedKey, DecorationKey, DecorationRootKey])
    context.provides[key] = null;
  Object.assign(context, {
    optionsCache: new WeakMap(),
    propsCache: new WeakMap(),
    emitsCache: new WeakMap(),
  });
  syncContext(context);
  return context;
};

// Draws into the content element, `render(vnode, dom)` patching what it last
// drew there, which Vue keeps as `dom._vnode` (an internal). Seeded with a
// vnode for `dom` itself, it patches `dom`'s children: Vue owns them as an
// element's, without the anchors it puts around a fragment, and leaves `dom`'s
// own attributes to Wordgard.
//
// `render()` also runs every pending callback of Vue's (`onMounted`, watchers),
// other apps' included, unless Vue is already running them. So it's never
// called while a component renders or a hook runs, where those callbacks
// would run before their own app is patched: an update from there is refused,
// and the editor tries again on the next frame. A hosted document is first
// drawn from WordgardDoc's `onMounted`, where Vue is running them already.
const vueRenderer = (
  dom: Element,
  { wg, failed }: RendererContext,
  mount: (() => void) | null
): HostedRenderer => {
  const empty = () => {
    const vnode = h(dom.localName, null, []);
    vnode.el = dom;
    return vnode;
  };
  Reflect.set(dom, "_vnode", empty());
  const wrappers = shallowRef(createNodeWrappers<Component>([]));
  // Vue draws a component that threw as a comment, and goes on: the doc tile
  // throws what it reported, and the next draw mounts the document anew.
  // Logged, as React logs what an error boundary catches.
  let failures = 0;
  let cleared = 0;
  const errorHandler = (thrown: unknown) => {
    console.error(thrown);
    failures++;
    failed(thrown);
  };
  const standalone = createApp({})._context;
  let context = documentContext(standalone, standalone.provides, wg, wrappers, errorHandler);
  let views: readonly ChildView[] = [];
  // What was last drawn, null before the first draw and after a detach.
  let last: VNode | null = null;
  const clear = () => {
    render(empty(), dom);
    last = null;
  };
  const draw = (next: readonly ChildView[]) => {
    if (failures != cleared) {
      clear();
      cleared = failures;
    }
    // The same shape: the nodes that changed render from their cells.
    const keep = last && shapeOf(next) == shapeOf(views);
    views = next;
    if (keep) return;
    last = DocNodeView(dom, views, context);
    try {
      render(last, dom);
    } catch (error) {
      // Not what Vue last drew: the next draw renders.
      last = null;
      throw error;
    }
  };
  const refuse = () => {
    if (last && getCurrentInstance())
      throw new RefusedUpdate(
        "VueWordgard can't update from inside a Vue component's setup, render or hook: read the editor's layout from useEditorEffect, useEditorLayoutEffect or an event handler"
      );
  };
  // The components a change set state for commit now. `render` runs Vue's
  // pending callbacks as it returns, but not those of updates made after it,
  // nor any when the document's list kept its shape: drawing the same vnode
  // again patches nothing and runs them. Every commit does, so the document's
  // watchers run inside the flush.
  const batch = (change: () => void, commit = false) => {
    refuse();
    change();
    if ((flushUpdates(context) || commit) && last) render(last, dom);
  };
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
      attach: (host) => {
        if (claims > 1) throw new Error("This editor is already rendered by another WordgardDoc");
        const attachment = ++attachments;
        // The components another WordgardDoc drew keep their app context:
        // unmounted, before its detach (a WordgardDoc moved mounts first).
        if (last) clear();
        context = documentContext(host.appContext, providesOf(host), wg, wrappers, errorHandler);
        try {
          draw(views);
          mount();
        } catch (error) {
          clear();
          throw error;
        }
        // Unmounts the document's components, leaving the content element,
        // unless another WordgardDoc has attached since.
        return () => {
          if (attachment != attachments || !last) return;
          clear();
        };
      },
    });
  }
  return {
    // A hosted editor's first layout, drawn when WordgardDoc attaches.
    prepare: (state, first) => {
      wrappers.value = state.facet(vueNodeWrappers.reader);
      views = first;
    },
    commit: (state, next, publish) =>
      batch(() => {
        publish();
        wrappers.value = state.facet(vueNodeWrappers.reader);
        draw(next);
      }, true),
    batch,
    redrawsAll,
    words: vueWords,
  };
};

export class VueDocTile extends RenderedDocTile {
  static create = (state: GardState, dom: Element, wg: Wordgard) =>
    createDocTile(VueDocTile, (dom, context) => vueRenderer(dom, context, null), state, dom, wg);

  // For an editor WordgardEditor hosts: Vue draws the document when
  // WordgardDoc mounts, which then calls `mount`.
  static host = (state: GardState, dom: Element, wg: Wordgard, mount: () => void) =>
    hostDocTile(VueDocTile, (dom, context) => vueRenderer(dom, context, mount), state, dom, wg);
}
