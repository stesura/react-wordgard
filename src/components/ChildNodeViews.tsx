// Named after react-prosemirror's ChildNodeViews, rewritten for Wordgard: draws
// what iterDeco lays out: nodes, text, mark wrappers and Wordgard's hack nodes.
import React from "react";
import type { Plot } from "wordgard/doc";

import { type ChildView, iterDeco } from "../decorations/iterDeco.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

type Props = {
  node: Plot;
};

// Keys are indices until R2 derives them from change sets.
const renderChildView = (view: ChildView, key: number) => {
  switch (view.type) {
    case "node":
      return <DefaultNodeView key={key} node={view.node} />;
    case "text":
      return <TextNodeView key={key} text={view.text} />;
    case "wrapper":
      return (
        <MarkView key={key} elt={view.elt}>
          {view.children.map(renderChildView)}
        </MarkView>
      );
    case "buffer":
      return <SeparatorHackView key={key} />;
    case "trailingHack":
      return <TrailingHackView key={key} />;
  }
};

export const ChildNodeViews = ({ node }: Props) => <>{iterDeco(node).map(renderChildView)}</>;
