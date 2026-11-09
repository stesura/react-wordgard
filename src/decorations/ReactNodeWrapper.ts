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

/** Picks the node types a wrapper goes around. */
type SelectTypes = (type: Node.Type) => boolean;

type Entry = {
  readonly type: Node.Type | null;
  readonly select: SelectTypes | null;
  readonly component: NodeWrapperComponent;
};

export type NodeWrappers = {
  /** A type's wrappers, the first outermost; undefined without any. */
  readonly of: (type: Node.Type) => readonly NodeWrapperComponent[] | undefined;
  readonly entries: readonly Entry[];
};

// Resolved per type once: the predicates run for each type the document draws.
export const createNodeWrappers = (entries: readonly Entry[]): NodeWrappers => {
  const resolved = new Map<Node.Type, readonly NodeWrapperComponent[] | undefined>();
  return {
    entries,
    of: (type) => {
      if (resolved.has(type)) return resolved.get(type);
      const components = entries
        .filter((entry) =>
          entry.type ? entry.type == type : type != Leaf.Text && !!entry.select?.(type)
        )
        .map((entry) => entry.component);
      const found = components.length ? components : undefined;
      resolved.set(type, found);
      return found;
    },
  };
};

const sameWrappers = (a: NodeWrappers, b: NodeWrappers) =>
  a.entries.length == b.entries.length &&
  a.entries.every((entry, i) => {
    const other = b.entries[i];
    return (
      !!other &&
      entry.type == other.type &&
      entry.select == other.select &&
      entry.component == other.component
    );
  });

export const nodeWrappers = GardState.Facet.define<Entry, NodeWrappers>({
  combine: createNodeWrappers,
  // A change redraws the whole document (ReactDocTile.updateRanges): an
  // extension built again with the same wrappers keeps the old value.
  compare: sameWrappers,
});

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
export const nodeWrapper = (
  // As Wordgard's Decoration.Tag functions: the type's parameter doesn't matter here.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type: Node.Type.Ref<any> | SelectTypes,
  component: NodeWrapperComponent
): GardState.Extension => {
  if (typeof type == "function") return nodeWrappers.of({ type: null, select: type, component });
  const resolved = Node.Type.get(type);
  // Text is drawn by TextNodeView, which no wrapper reaches.
  if (resolved == Leaf.Text) throw new Error("A node wrapper can't wrap text");
  return nodeWrappers.of({ type: resolved, select: null, component });
};
