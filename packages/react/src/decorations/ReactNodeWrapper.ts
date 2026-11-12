// Not in react-prosemirror. Stesura's react-prosemirror fork had them as its node-view wrappers
// (`nodeViewWrappers`): a component around a node's view that renders no element, for an
// extension to hand the view data (through a context) without owning it. Wordgard has no
// counterpart: every decoration it knows draws an element, so this is a facet only React reads
// (nodeWrapperType.ts).
import type { ComponentType, ReactNode } from "react";
import type { Node } from "wordgard/doc";
import type { GardState } from "wordgard/state";

import {
  type SelectTypes,
  type NodeWrappers as Wrappers,
  defineNodeWrappers,
} from "@stesura/wordgard-view";

/** A node wrapper's props: the node, its position, and what it wraps: the node's drawing. */
export type NodeWrapperComponentProps = {
  nodeProps: {
    node: Node;
    getPos: () => number;
  };
  children: ReactNode;
};

type NodeWrapperComponent = ComponentType<NodeWrapperComponentProps>;

export type NodeWrappers = Wrappers<NodeWrapperComponent>;

const defined = defineNodeWrappers<NodeWrapperComponent>();

export const nodeWrappers = defined.facet;

/**
 * A component around the drawing of every node of `type`, or of every type `select` picks,
 * rendering no element of its own: its `children` is the node's drawing, which it renders as it
 * is. It hands the node's shape data through a context (attributes, styles, chrome), and
 * re-renders from its own state without redrawing the node; around a node Wordgard draws, it gives
 * the node's element props with `NodeRootProps`. Several on one type nest, the one with the highest
 * precedence outermost. Text can't be wrapped. Changing the wrappers (a reconfiguration, or a new
 * `select` function) draws the whole document again, so data that changes goes through the
 * component's state or a store, not the configuration.
 */
export const nodeWrapper: (
  // As Wordgard's Decoration.Tag functions: the type's parameter doesn't matter here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: Node.Type.Ref<any> | SelectTypes,
  component: NodeWrapperComponent
) => GardState.Extension = defined.nodeWrapper;
