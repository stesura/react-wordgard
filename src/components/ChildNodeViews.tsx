// Named after react-prosemirror's ChildNodeViews, rewritten for Wordgard: draws
// what iterDeco lays out: nodes, text, mark wrappers, Wordgard's hack nodes and
// React widgets. Native widgets aren't React's: ReactDocTile puts their DOM in
// place after the commit.
import React from "react";

import { isReactWidget } from "../decorations/ReactWidgetType.js";
import type { ChildView } from "../decorations/iterDeco.js";
import { childViewKeys } from "../reactKeys.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { WidgetView } from "./WidgetView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

type Props = {
  views: readonly ChildView[];
};

const renderChildViews = (views: readonly ChildView[]) =>
  childViewKeys(views).map(({ view, key }) => {
    switch (view.type) {
      case "node":
        return <DefaultNodeView key={key} view={view} />;
      case "text":
        return <TextNodeView key={key} text={view.text} />;
      case "wrapper":
        return (
          <MarkView key={key} elt={view.elt}>
            {renderChildViews(view.children)}
          </MarkView>
        );
      case "buffer":
        return <SeparatorHackView key={key} />;
      case "composition":
        // React keeps what it last committed in its own node, so it never
        // writes to it; the browser's own node isn't React's to draw.
        return view.rendered === null ? null : <TextNodeView key={key} text={view.rendered} />;
      case "trailingHack":
        return <TrailingHackView key={key} />;
      case "widget":
        return isReactWidget(view.widget) ? <WidgetView key={key} widget={view.widget} /> : null;
    }
  });

export const ChildNodeViews = ({ views }: Props) => <>{renderChildViews(views)}</>;
