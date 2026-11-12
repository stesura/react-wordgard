// Adapted from react-wordgard's ChildNodeViews for Vue: what iterDeco lays out, as an element's own
// children. Functions returning vnodes, not a component: a component with several roots puts
// anchors (empty text nodes) around them, so `drawList` stands for React's memo. Native widgets
// draw nothing: the doc tile puts their DOM in place after the commit.
import type { VNode } from "vue";
import { h } from "vue";
import { Elt } from "wordgard/doc";

import { type ChildView, shapeOf } from "../../../src/decorations/iterDeco.js";
import { isReactWidget } from "../../../src/decorations/widgetType.js";
import { childViewKeys } from "../../../src/reactKeys.js";
import { cellOf } from "../../../src/renderStore.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { WidgetView } from "./WidgetView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

export const renderChildViews = (views: readonly ChildView[]): VNode[] =>
  childViewKeys(views).flatMap(({ view, key }) => {
    switch (view.type) {
      case "node":
        return view.shape instanceof Elt || isReactWidget(view.shape)
          ? [h(DefaultNodeView, { key, cell: cellOf(view) })]
          : [];
      case "text":
        return [TextNodeView(key, view.text)];
      case "wrapper":
        return [MarkView(key, view)];
      case "buffer":
        return [SeparatorHackView(key)];
      case "composition":
        // Vue keeps what it last committed in its own node, so it never
        // writes to it; the browser's own node isn't Vue's to draw.
        return view.rendered === null ? [] : [TextNodeView(key, view.rendered)];
      case "trailingHack":
        return [TrailingHackView(key)];
      case "widget":
        return isReactWidget(view.widget) ? [h(WidgetView, { key, widget: view.widget })] : [];
    }
  });

// A list's vnodes as last drawn, and its shape.
export type DrawnList = { readonly shape: object; readonly vnodes: VNode[] };

const kept: readonly never[] = [];

// The vnodes of a list, `last`'s while the list keeps its shape (iterDeco's
// shapeOf): Vue skips a vnode it already drew, so only the nodes whose cell
// changed render, from their cells. Vue would clone a mounted vnode given
// again, unless it has a `memo` (an internal: v-memo's way to reuse one).
// Only for a list drawn in the same place as `last`.
export const drawList = (views: readonly ChildView[], last: DrawnList | null): DrawnList => {
  const shape = shapeOf(views);
  if (last?.shape == shape) return last;
  const vnodes = renderChildViews(views);
  for (const vnode of vnodes) Reflect.set(vnode, "memo", kept);
  return { shape, vnodes };
};
