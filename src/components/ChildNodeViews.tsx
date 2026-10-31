// Named after react-prosemirror's ChildNodeViews, rewritten for Wordgard: draws
// what iterDeco lays out: nodes, text, mark wrappers and Wordgard's hack nodes.
import React from "react";
import type { Plot } from "wordgard/doc";

import { useRenderStore } from "../contexts/RenderStoreContext.js";
import { type ChildView, iterDeco } from "../decorations/iterDeco.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

type Props = {
  node: Plot;
};

// A node's key comes from ReactKeys. Other views are keyed after their previous
// sibling, so a text run keeps its text node while its start changes.
const renderChildViews = (views: readonly ChildView[], nodeKeys: readonly string[]) => {
  let previous = "";
  return views.map((view) => {
    const key =
      view.type == "node"
        ? nodeKeys[view.index]
        : `${previous}>${view.type == "buffer" ? `buffer${view.side}` : view.type}`;
    if (!key) throw new Error(`No key for ${view.type == "node" ? view.node.name : view.type}`);
    previous = key;
    return renderChildView(view, key, nodeKeys);
  });
};

const renderChildView = (view: ChildView, key: string, nodeKeys: readonly string[]) => {
  switch (view.type) {
    case "node":
      return <DefaultNodeView key={key} node={view.node} />;
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
    case "trailingHack":
      return <TrailingHackView key={key} />;
  }
};

export const ChildNodeViews = ({ node }: Props) => {
  const nodeKeys = useRenderStore().keys.get(node);
  if (!nodeKeys) throw new Error(`No keys for ${node.name}`);
  return <>{renderChildViews(iterDeco(node), nodeKeys)}</>;
};
