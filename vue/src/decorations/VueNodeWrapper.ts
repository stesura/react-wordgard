// Adapted from react-wordgard's ReactNodeWrapper.ts for Vue (src/decorations/nodeWrapperType.ts):
// a component around a node's drawing, rendering no element. It draws the node as its root, a
// WrappedNode, so the attributes it gives that fall through to the node's root element, and no
// fragment leaves anchors in the content.
import type { Component } from "vue";
import type { Node } from "wordgard/doc";
import type { GardState } from "wordgard/state";

import { type SelectTypes, defineNodeWrappers } from "../../../src/decorations/nodeWrapperType.js";

/** A node wrapper's props: the node and its position. Its root is a `WrappedNode`. */
export type NodeWrapperComponentProps = {
  nodeProps: {
    node: Node;
    getPos: () => number;
  };
};

const defined = defineNodeWrappers<Component>();

export const vueNodeWrappers = defined.facet;

/**
 * A component around the drawing of every node of `type`, or of every type `select` picks,
 * rendering no element of its own: its root is a `WrappedNode`, the node's drawing, whose
 * attributes fall through to the node's root element. It hands the node's shape data through
 * `provide`, and re-renders from its own state without redrawing the node's content. Several on one
 * type nest, the one with the highest precedence outermost. Text can't be wrapped. Changing the
 * wrappers draws the whole document again.
 */
export const nodeWrapper: (
  // As Wordgard's Decoration.Tag functions: the type's parameter doesn't matter here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: Node.Type.Ref<any> | SelectTypes,
  component: Component
) => GardState.Extension = defined.nodeWrapper;
