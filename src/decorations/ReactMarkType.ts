// Named after ReactWidgetType: a React mark is a mark's element shape (for
// `Decoration.Mark.shape`, or a mark type's own spec), the element plain
// Wordgard draws, registered as drawn by a component, which renders the
// marked content as `children`. Wordgard's mark shapes are declarative, so the
// registration is the reserved attribute React shapes use, which the element
// Wordgard makes from the shape keeps. The props follow react-prosemirror's
// MarkComponentProps.
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

import type { Tile } from "../wordgardInternals.js";
import { idOf, reserved } from "./ReactShapeType.js";

export type MarkComponentProps<E extends Element = HTMLElement> = AllHTMLAttributes<HTMLElement> & {
  markProps: {
    mark: Mark;
    getPos: () => number;
    contentDOMRef: RefCallback<Element>;
  };
  children: ReactNode;
} & RefAttributes<E>;

export type MarkShapeOptions = {
  // The component's root element, which plain Wordgard draws. Wordgard's mark
  // shape is a static spec, also a mark type's own `shape` before the type
  // exists, so the element can't come from the mark type.
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

export const createMarkShape = <E extends Element = HTMLElement>(
  component: ComponentType<MarkComponentProps<E>>,
  { element = "span" }: MarkShapeOptions = {}
): MarkShape => {
  const id = `m${draws.size + 1}`;
  draws.set(id, ({ attrs, markProps, children, ref }) =>
    createElement(component, { ...attrs, ref, markProps, children })
  );
  return { element, attributes: { [reserved]: id } };
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
