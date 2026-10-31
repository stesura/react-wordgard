// Named after react-prosemirror's DefaultNodeView, rewritten for Wordgard: a
// plot renders as its type's shape, an element whose only child is the content
// hole.
import React, { createElement, memo } from "react";
import type { Plot } from "wordgard/doc";

import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  node: Plot;
};

// Wordgard's documents share unchanged nodes between states, so a node that
// keeps its identity doesn't re-render.
export const DefaultNodeView = memo(({ node }: Props) => {
  const { tagName, attrs } = node.type.shape.create(node.tag.param);
  //no need to check toDom, in wordgard, shapes are required.
  return createElement(
    tagName,
    htmlAttrsToReactProps(attrsToRecord(attrs)),
    <ChildNodeViews node={node} />
  );
});
