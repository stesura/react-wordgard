// Named after react-prosemirror's ChildNodeViews, rewritten for Wordgard: draws
// what iterDeco lays out: nodes, text, mark wrappers and Wordgard's hack nodes.
import React from "react";
import type { Plot } from "wordgard/doc";

import { useRenderStore } from "../contexts/RenderStoreContext.js";
import { type CompositionView, compositionKey } from "../composition.js";
import { type ChildView, iterDeco, iterDecoComposing } from "../decorations/iterDeco.js";
import { childViewKeys } from "../reactKeys.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

type Props = {
  node: Plot;
  // Set on the plots down to an ongoing composition.
  composition?: CompositionView;
};

const renderChildViews = (
  views: readonly ChildView[],
  nodeKeys: readonly string[],
  composition?: CompositionView
) => {
  return childViewKeys(views, nodeKeys, compositionKey(composition)).map(({ view, key }) => {
    switch (view.type) {
      case "node":
        return (
          <DefaultNodeView
            key={key}
            node={view.node}
            composition={
              view.node.isPlot && composition?.path.has(view.node) ? composition : undefined
            }
          />
        );
      case "text":
        return <TextNodeView key={key} text={view.text} />;
      case "wrapper":
        return (
          <MarkView key={key} elt={view.elt}>
            {renderChildViews(view.children, nodeKeys, composition)}
          </MarkView>
        );
      case "buffer":
        return <SeparatorHackView key={key} />;
      case "composition":
        // React keeps what it last committed in its own node, so it never
        // writes to it; the browser's own node isn't React's to draw.
        return composition?.rendered ? (
          <TextNodeView key={key} text={composition.rendered.text} />
        ) : null;
      case "trailingHack":
        return <TrailingHackView key={key} />;
    }
  });
};

export const ChildNodeViews = ({ node, composition }: Props) => {
  const nodeKeys = useRenderStore().keys.get(node);
  if (!nodeKeys) throw new Error(`No keys for ${node.name}`);
  const views =
    composition?.plot == node ? iterDecoComposing(node, composition.layout) : iterDeco(node);
  return <>{renderChildViews(views, nodeKeys, composition)}</>;
};
