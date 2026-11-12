// Adapted from react-wordgard's ReactDocTile.ts for Vue: Vue's renderer for our DocTile. Vue has
// no flushSync, but `render()` patches at once when the change comes from the root, as here: the
// whole document is drawn from its views on every update (no per-node updates yet), then the
// components whose own state the update changed commit (sync.ts).
import {
  type Component,
  type VNode,
  createApp,
  getCurrentInstance,
  h,
  render,
  shallowRef,
} from "vue";
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { createNodeWrappers } from "../../src/decorations/nodeWrapperType.js";
import { editorOf } from "../../src/editorStore.js";
import {
  RefusedUpdate,
  RenderedDocTile,
  type Renderer,
  type RendererContext,
  createDocTile,
} from "../../src/tile.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { EditorKey, NodeWrappersKey } from "./contexts/EditorContext.js";
import { vueNodeWrappers } from "./decorations/VueNodeWrapper.js";
import { flushUpdates, syncMixin } from "./sync.js";
import { vueWords } from "./words.js";

const redrawsAll = (before: GardState, after: GardState) =>
  before.facet(vueNodeWrappers.reader) != after.facet(vueNodeWrappers.reader);

// `render(vnode, dom)` patches what it last drew in `dom`, which Vue keeps as
// `dom._vnode` (an internal). Seeded with a vnode for `dom` itself, it patches
// `dom`'s children: Vue owns them as an element's, without the anchors it
// puts around a fragment, and leaves `dom`'s own attributes to Wordgard. The
// document's components get the editor from an app context of the editor's
// own: there's no component above them to provide it.
const vueRoot = (dom: Element, { wg, failed }: RendererContext): Renderer => {
  const root = h(dom.localName, null, []);
  root.el = dom;
  Reflect.set(dom, "_vnode", root);
  const app = createApp({});
  const wrappers = shallowRef(createNodeWrappers<Component>([]));
  app.provide(EditorKey, editorOf(wg));
  app.provide(NodeWrappersKey, wrappers);
  app.mixin(syncMixin);
  // Vue draws a component that threw as a comment, and goes on: the doc tile
  // throws what it reported, and the next commit mounts the document anew.
  // Logged, as React logs what an error boundary catches.
  let failures = 0;
  let cleared = 0;
  app.config.errorHandler = (thrown) => {
    console.error(thrown);
    failures++;
    failed(thrown);
  };
  const context = app._context;
  let last: VNode = root;
  // From inside one of the document's components (its render, a hook), Vue
  // would patch the tree it is patching: refused, as React refuses an update
  // from inside its render, and VueWordgard flushes again on the next frame.
  const refuse = () => {
    if (getCurrentInstance()?.appContext == context)
      throw new RefusedUpdate(
        "VueWordgard can't update from inside the document's components (a render, a hook): read the editor's layout from an event handler or after its update"
      );
  };
  // The components a change set state for commit now. `render` flushes Vue's
  // post-flush callbacks (`onMounted`, `onUpdated`) as it returns, but not
  // those of updates made after it: drawing the same vnode again patches
  // nothing and flushes them.
  const batch = (change: () => void) => {
    refuse();
    change();
    if (flushUpdates(context)) render(last, dom);
  };
  return {
    commit: (state, views, publish) => {
      refuse();
      if (failures != cleared) {
        render(h(dom.localName, null, []), dom);
        cleared = failures;
      }
      batch(() => {
        publish();
        wrappers.value = state.facet(vueNodeWrappers.reader);
        last = DocNodeView(dom, views, context);
        render(last, dom);
      });
    },
    batch,
    redrawsAll,
    words: vueWords,
  };
};

export class VueDocTile extends RenderedDocTile {
  static create = (state: GardState, dom: Element, wg: Wordgard) =>
    createDocTile(VueDocTile, vueRoot, state, dom, wg);
}
