// Adapted from react-wordgard's ChildNodeViews for Vue: what iterDeco lays out, as an element's own
// children. A function returning vnodes, not a component: a component with several roots puts
// anchors (empty text nodes) around them. Native widgets draw nothing: the doc tile puts their DOM
// in place after the commit.
import type { VNode } from "vue";
import { h } from "vue";
import { Elt } from "wordgard/doc";

import type { ChildView } from "../../../src/decorations/iterDeco.js";
import { isReactWidget } from "../../../src/decorations/widgetType.js";
import { childViewKeys } from "../../../src/reactKeys.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

// No component decorations yet.
export const unsupported = (what: string) =>
  new Error(`vue-wordgard can't draw ${what} yet: component decorations aren't supported`);

export const renderChildViews = (views: readonly ChildView[]): VNode[] =>
  childViewKeys(views).flatMap(({ view, key }) => {
    switch (view.type) {
      case "node":
        if (view.shape instanceof Elt) return [h(DefaultNodeView, { key, view })];
        if (isReactWidget(view.shape)) throw unsupported(view.node.name);
        return [];
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
        if (isReactWidget(view.widget)) throw unsupported("a component widget");
        return [];
    }
  });
