// Split from ReactNodeWrapper.ts, without React: the facet of a framework's node wrappers, by node
// type, generic over its component type.
import { Leaf, Node } from "wordgard/doc";
import { GardState } from "wordgard/state";

/** Picks the node types a wrapper goes around. */
export type SelectTypes = (type: Node.Type) => boolean;

type Entry<C> = {
  readonly type: Node.Type | null;
  readonly select: SelectTypes | null;
  readonly component: C;
};

export type NodeWrappers<C> = {
  /** A type's wrappers, the first outermost; undefined without any. */
  readonly of: (type: Node.Type) => readonly C[] | undefined;
  readonly entries: readonly Entry<C>[];
};

// Resolved per type once: the predicates run for each type the document draws.
export const createNodeWrappers = <C>(entries: readonly Entry<C>[]): NodeWrappers<C> => {
  const resolved = new Map<Node.Type, readonly C[] | undefined>();
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

const sameWrappers = <C>(a: NodeWrappers<C>, b: NodeWrappers<C>) =>
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

// A framework's facet, and its `nodeWrapper` function.
export const defineNodeWrappers = <C>() => {
  const facet = GardState.Facet.define<Entry<C>, NodeWrappers<C>>({
    combine: createNodeWrappers,
    // A change redraws the whole document (the renderer's `redrawsAll`): an
    // extension built again with the same wrappers keeps the old value.
    compare: sameWrappers,
  });
  const nodeWrapper = (
    // As Wordgard's Decoration.Tag functions: the type's parameter doesn't matter here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    type: Node.Type.Ref<any> | SelectTypes,
    component: C
  ): GardState.Extension => {
    if (typeof type == "function") return facet.of({ type: null, select: type, component });
    const resolved = Node.Type.get(type);
    // Text is drawn as a bare text node, which no wrapper reaches.
    if (resolved == Leaf.Text) throw new Error("A node wrapper can't wrap text");
    return facet.of({ type: resolved, select: null, component });
  };
  return { facet, nodeWrapper };
};
