// Not in react-prosemirror. Stesura's react-prosemirror fork had them as its node-view wrappers
// (`nodeViewWrappers`): a component around a node's view that renders no element, for an
// extension to hand the view data (through a context) without owning it. Wordgard has no
// counterpart: every decoration it knows draws an element, so this is a facet only React reads.
import type { ComponentType, ReactNode } from "react";
import { Leaf, Node } from "wordgard/doc";
import { GardState } from "wordgard/state";

/** A node wrapper's props: the node, its position, and what it wraps: the node's drawing. */
export type NodeWrapperComponentProps = {
  nodeProps: {
    node: Node;
    getPos: () => number;
  };
  children: ReactNode;
};

type NodeWrapperComponent = ComponentType<NodeWrapperComponentProps>;

type Entry = { readonly type: Node.Type; readonly component: NodeWrapperComponent };

export type NodeWrappers = ReadonlyMap<Node.Type, readonly NodeWrapperComponent[]>;

const sameWrappers = (a: NodeWrappers, b: NodeWrappers) => {
  if (a.size != b.size) return false;
  for (const [type, components] of a) {
    const other = b.get(type);
    if (!other || other.length != components.length) return false;
    if (components.some((component, i) => component != other[i])) return false;
  }
  return true;
};

export const nodeWrappers = GardState.Facet.define<Entry, NodeWrappers>({
  combine: (entries) => {
    const byType = new Map<Node.Type, NodeWrapperComponent[]>();
    for (const { type, component } of entries) {
      const list = byType.get(type);
      if (list) list.push(component);
      else byType.set(type, [component]);
    }
    return byType;
  },
  // A change redraws the whole document (ReactDocTile.updateRanges): an
  // extension built again with the same wrappers keeps the old value.
  compare: sameWrappers,
});

/**
 * A component around the drawing of every node of `type`, rendering no element of its own: its
 * `children` is the node's drawing, which it renders as it is. It hands the node's shape data
 * through a context (attributes, styles, chrome), and re-renders from its own state without
 * redrawing the node. Several on one type nest, the one with the highest precedence outermost.
 * Text can't be wrapped. Changing the wrappers (a reconfiguration) draws the whole document again,
 * so data that changes goes through the component's state or a store, not the configuration.
 */
export const nodeWrapper = (
  // As Wordgard's Decoration.Tag functions: the type's parameter doesn't matter here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: Node.Type.Ref<any>,
  component: NodeWrapperComponent
): GardState.Extension => {
  const resolved = Node.Type.get(type);
  // Text is drawn by TextNodeView, which no wrapper reaches.
  if (resolved == Leaf.Text) throw new Error("A node wrapper can't wrap text");
  return nodeWrappers.of({ type: resolved, component });
};
