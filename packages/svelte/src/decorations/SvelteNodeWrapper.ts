// Adapted from react-wordgard's ReactNodeWrapper.ts (by way of vue-wordgard's VueNodeWrapper.ts)
// for Svelte (the core's decorations/nodeWrapperType.ts): a component around a node's drawing,
// drawing no element. Its root is a WrappedNode, which hands the node its contexts and its
// attributes (components/NodeWrapperView.ts).
import type { Component } from "svelte";
import type { Node } from "wordgard/doc";
import type { GardState } from "wordgard/state";

import { type SelectTypes, defineNodeWrappers } from "@stesura/wordgard-view";
import type { AnyComponent } from "../helpers/mountRoot.js";

/** A node wrapper's props: the node and its position. Its root is a `WrappedNode`. */
export type NodeWrapperComponentProps = {
  nodeProps: {
    node: Node;
    getPos: () => number;
  };
};

const defined = defineNodeWrappers<AnyComponent>();

export const svelteNodeWrappers = defined.facet;

/**
 * A component around the drawing of every node of `type`, or of every type `select` picks,
 * drawing no element of its own: its root is a `WrappedNode`, whose attributes go on the node's
 * root element. It hands the node's shape data through `setContext`, and re-renders from its own
 * state without redrawing the node. Several on one type nest, the one with the highest precedence
 * outermost. Text can't be wrapped. Changing the wrappers draws the whole document again. The
 * component may leave out its props.
 */
export const nodeWrapper: (
  // As Wordgard's Decoration.Tag functions: the type's parameter doesn't matter here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: Node.Type.Ref<any> | SelectTypes,
  component: Component<NodeWrapperComponentProps> | Component<Record<string, never>>
) => GardState.Extension = defined.nodeWrapper;
