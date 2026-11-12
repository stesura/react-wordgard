// Adapted from react-wordgard's DocNodeView for Vue: Wordgard's content element itself, its
// children the document's content. Its vnode stands for the element Wordgard made (VueDocTile), so
// Vue patches its children in place: a fragment would put an anchor (an empty text node) at each
// end, which Wordgard would count among the element's children.
import { type AppContext, type VNode, h, isVNode } from "vue";

import type { ChildView } from "../../../../src/decorations/iterDeco.js";
import { renderChildViews } from "../ChildNodeViews.js";

// Components with no component above them (the document's nodes, or those in
// an element at the top, a range wrapper's) take their app context from their
// vnode: the editor's, for inject.
const adopt = (vnodes: readonly unknown[], context: AppContext) => {
  for (const vnode of vnodes) {
    if (!isVNode(vnode)) continue;
    if (typeof vnode.type == "object" || typeof vnode.type == "function")
      vnode.appContext = context;
    else if (Array.isArray(vnode.children)) adopt(vnode.children, context);
  }
};

export const DocNodeView = (
  dom: Element,
  views: readonly ChildView[],
  context: AppContext
): VNode => {
  const children = renderChildViews(views);
  adopt(children, context);
  return h(dom.localName, null, children);
};
