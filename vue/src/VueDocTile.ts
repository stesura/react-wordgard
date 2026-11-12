// Adapted from react-wordgard's ReactDocTile.ts for Vue: Vue's renderer for our DocTile. Vue has
// no flushSync, but `render()` patches at once when the change comes from the root, as here: the
// whole document is drawn from its views on every update (no per-node updates yet). Vue never
// refuses to commit, so there's no RefusedUpdate.
import { h, render } from "vue";
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { RenderedDocTile, type Renderer, createDocTile } from "../../src/tile.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";

// `render(vnode, dom)` patches what it last drew in `dom`, which Vue keeps as
// `dom._vnode` (an internal). Seeded with a vnode for `dom` itself, it patches
// `dom`'s children: Vue owns them as an element's, without the anchors it
// puts around a fragment, and leaves `dom`'s own attributes to Wordgard.
const vueRoot = (dom: Element): Renderer => {
  const root = h(dom.localName, null, []);
  root.el = dom;
  Reflect.set(dom, "_vnode", root);
  return {
    commit: (_state, views, publish) => {
      publish();
      render(DocNodeView(dom, views), dom);
    },
    batch: (change) => change(),
    redrawsAll: () => false,
  };
};

export class VueDocTile extends RenderedDocTile {
  static create = (state: GardState, dom: Element, wg: Wordgard) =>
    createDocTile(VueDocTile, vueRoot, state, dom, wg);
}
