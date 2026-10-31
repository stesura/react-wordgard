// Named after react-prosemirror's DefaultNodeView, rewritten for Wordgard: a
// node renders as its type's shape (Wordgard's buildNodeShape), its marks'
// attributes included, with the plot's content in the hole. In Wordgard every
// node type has a shape, so there's no missing `toDOM` to check for.
import React, { type ReactElement, type ReactNode, createElement, memo } from "react";
import type { Elt, Node } from "wordgard/doc";

import { nodeShape, uneditable } from "../../decorations/iterDeco.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  node: Node;
};

const renderShape = (
  shape: Elt,
  inEditable: boolean,
  content: ReactNode,
  key?: number
): ReactElement => {
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  const props = {
    key,
    suppressContentEditableWarning: true,
    ...htmlAttrsToReactProps(attrsToRecord(elt.attrs)),
  };
  return createElement(
    elt.tagName,
    props,
    ...elt.children.map((child, i) =>
      child === 0
        ? content
        : typeof child == "string"
          ? child
          : renderShape(child, inner, content, i)
    )
  );
};

// Wordgard's documents share unchanged nodes between states, so a node that
// keeps its identity doesn't re-render.
export const DefaultNodeView = memo(({ node }: Props) =>
  renderShape(nodeShape(node), true, node.isPlot ? <ChildNodeViews node={node} /> : null)
);
