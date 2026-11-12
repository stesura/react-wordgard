// Adapted from react-wordgard's DocNodeView for Vue: Wordgard's content element itself, its
// children the document's content. Its vnode stands for the element Wordgard made (VueDocTile), so
// Vue patches its children in place: a fragment would put an anchor (an empty text node) at each
// end, which Wordgard would count among the element's children.
import { h } from "vue";

import type { ChildView } from "../../../../src/decorations/iterDeco.js";
import { renderChildViews } from "../ChildNodeViews.js";

export const DocNodeView = (dom: Element, views: readonly ChildView[]) =>
  h(dom.localName, null, renderChildViews(views));
