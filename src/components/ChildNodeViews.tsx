// Named after react-prosemirror's ChildNodeViews, rewritten for Wordgard: draws
// what iterDeco lays out: nodes, text, mark wrappers and Wordgard's hack nodes.
// Widgets aren't React's: ReactDocTile puts their DOM in place after the commit.
import React from "react";
import type { Plot } from "wordgard/doc";

import { useRenderStore } from "../contexts/RenderStoreContext.js";
import type { ChildView } from "../decorations/iterDeco.js";
import { childViewKeys } from "../reactKeys.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

type Props = {
  node: Plot;
  views: readonly ChildView[];
};

const renderChildViews = (views: readonly ChildView[], nodeKeys: readonly string[]) =>
  childViewKeys(views, nodeKeys).map(({ view, key }) => {
    switch (view.type) {
      case "node":
        return <DefaultNodeView key={key} view={view} />;
      case "text":
        return <TextNodeView key={key} text={view.text} />;
      case "wrapper":
        return (
          <MarkView key={key} elt={view.elt}>
            {renderChildViews(view.children, nodeKeys)}
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
        return null;
    }
  });

export const ChildNodeViews = ({ node, views }: Props) => {
  const nodeKeys = useRenderStore().keys.get(node);
  if (!nodeKeys) throw new Error(`No keys for ${node.name}`);
  return <>{renderChildViews(views, nodeKeys)}</>;
};
