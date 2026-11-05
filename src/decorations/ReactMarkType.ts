// Named after ReactWidgetType. A React mark is a mark's element shape, registered as drawn by a
// component through the reserved attribute React shapes use: Wordgard's mark shapes are
// declarative. The props follow react-prosemirror's MarkComponentProps.
import {
  type AllHTMLAttributes,
  type ComponentType,
  type HTMLProps,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  type RefCallback,
  createElement,
} from "react";
import type { Elt, Mark } from "wordgard/doc";

import { takesRef } from "../helpers/refs.js";
import type { Tile } from "../wordgardInternals.js";
import { idOf, reserved } from "./ReactShapeType.js";

/**
 * A React mark's props, for each run of an equal mark: `markProps.mark` is the document's mark.
 */
export type MarkComponentProps<E extends Element = HTMLElement> = AllHTMLAttributes<HTMLElement> & {
  markProps: {
    mark: Mark;
    getPos: () => number;
    contentDOMRef: RefCallback<Element>;
  };
  children: ReactNode;
} & RefAttributes<E>;

/** `createMarkShape`'s options. */
export type MarkShapeOptions = {
  /**
   * The component's root element, `span` by default, which plain Wordgard draws. It can't come from
   * the mark type: a mark type's own `shape` is written before the type exists.
   */
  element?: string;
};

type DrawProps = {
  attrs: HTMLProps<HTMLElement>;
  markProps: MarkComponentProps["markProps"];
  children: ReactNode;
  ref: RefCallback<Element>;
};

// Keyed apart from React shapes' and wrappers' ids, which share the attribute.
const draws = new Map<string, (props: DrawProps) => ReactElement>();

// A Shape.Element with no function of the mark's value, so it fits any mark
// type's.
type MarkShape = { element: string; attributes: Record<string, string> };

// By component, then root element, as React shapes are.
const marks = new WeakMap<object, { id: string; shapes: Map<string, MarkShape> }>();

/**
 * A mark's shape, for `Decoration.Mark.shape(MarkType, shape)` or a mark type's own `shape`.
 */
export const createMarkShape = <E extends Element = HTMLElement>(
  component: ComponentType<MarkComponentProps<E>>,
  { element = "span" }: MarkShapeOptions = {}
): MarkShape => {
  let registered = marks.get(component);
  if (!registered) {
    const id = `m${draws.size + 1}`;
    draws.set(id, ({ attrs, markProps, children, ref }) =>
      createElement(component, {
        ...attrs,
        ref: takesRef(component) ? ref : undefined,
        markProps,
        children,
      })
    );
    registered = { id, shapes: new Map() };
    marks.set(component, registered);
  }
  let shape = registered.shapes.get(element);
  if (!shape) {
    shape = { element, attributes: { [reserved]: registered.id } };
    registered.shapes.set(element, shape);
  }
  return shape;
};

export const isReactMark = (elt: Elt<unknown>) => {
  const id = idOf(elt);
  return id != null && draws.has(id);
};

export const drawMark = (elt: Elt<unknown>, props: DrawProps) => {
  const draw = draws.get(idOf(elt) ?? "");
  if (!draw) throw new Error("Not a React mark");
  return draw(props);
};

// The tiles over React marks' elements, and the mark each root's is for: a
// composition inside one sits in one wrapper, not in each of its elements.
export const markTiles: WeakSet<Tile> = new WeakSet();
export const markOfTile: WeakMap<Tile, Mark> = new WeakMap();
