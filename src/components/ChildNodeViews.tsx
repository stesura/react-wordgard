// Named after react-prosemirror's ChildNodeViews, rewritten for Wordgard.
// Renders only plots and unmarked text so far.
import React from "react";
import { Leaf, type Plot } from "wordgard/doc";

import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { DefaultNodeView } from "./nodes/DefaultNodeView.js";

type Props = {
  node: Plot;
};

// Wordgard 0.6.2 can leave empty text leaves in a document (later versions
// refuse them). React draws no text node for them, so they're drawn as
// nothing, and a textblock holding only those gets the trailing <br>.
export const needsTrailingHack = (node: Plot) =>
  node.isTextblock && node.content.every((child) => child.is(Leaf.Text) && !child.param);

// Keys are indices until R2 derives them from change sets.
export const ChildNodeViews = ({ node }: Props) => (
  <>
    {node.content.map((child, i) =>
      child.isPlot ? (
        <DefaultNodeView key={i} node={child} />
      ) : child.is(Leaf.Text) ? (
        <TextNodeView key={i} text={child.param} />
      ) : null
    )}
    {needsTrailingHack(node) && <TrailingHackView />}
  </>
);
