// Split from ReactMarkType.ts, without React: a mark a component draws is a mark's element shape,
// registered through the reserved attribute shapes use (Wordgard's mark shapes are declarative).
// Also the tiles over such marks' elements.
import type { Elt, Mark } from "wordgard/doc";

import type { Tile } from "../wordgardInternals.js";
import { idOf, reserved } from "./shapeType.js";

// A Shape.Element with no function of the mark's value, so it fits any mark
// type's.
export type MarkShape = { element: string; attributes: Record<string, string> };

// Keyed apart from shapes' and wrappers' ids, which share the attribute.
const markIds = new Set<string>();

// A new mark shape: its id, which its component is registered under, and the
// shape for each root element.
export const defineMarkShape = () => {
  const id = `m${markIds.size + 1}`;
  markIds.add(id);
  const shapes = new Map<string, MarkShape>();
  const shape = (element: string) => {
    let found = shapes.get(element);
    if (!found) {
      found = { element, attributes: { [reserved]: id } };
      shapes.set(element, found);
    }
    return found;
  };
  return { id, shape };
};

export const isReactMark = (elt: Elt<unknown>) => {
  const id = idOf(elt);
  return id != null && markIds.has(id);
};

// The tiles over React marks' elements, and the mark each root's is for: a
// composition inside one sits in one wrapper, not in each of its elements.
export const markTiles: WeakSet<Tile> = new WeakSet();
export const markOfTile: WeakMap<Tile, Mark> = new WeakMap();
