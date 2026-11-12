// Named after ReactWidgetType. A React shape is a real Wordgard `Elt` (shapeType.ts), registered as
// drawn by a component. The props follow react-prosemirror's node views (`nodeProps`,
// `contentDOMRef`, a forwarded ref).
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
import type { Node as DocNode, Elt } from "wordgard/doc";

import { takesRef } from "../helpers/refs.js";
import { type ComponentShape, defineShape, idOf } from "./shapeType.js";

/**
 * A React shape's props: `nodeProps`, the content as `children`, and Wordgard's attributes and
 * `ref` for its root. The content goes in the `contentDOMRef` element, else in the root; in an
 * atom, `children` is empty and a `contentDOMRef` throws. With `<DecorationRoot>` as the root, the
 * attributes and `ref` are taken care of; a root drawn by hand spreads them onto itself (see [A
 * root drawn by hand](https://github.com/stesura/react-wordgard#a-root-drawn-by-hand)).
 */
export type ShapeComponentProps<E extends Element = HTMLElement> =
  AllHTMLAttributes<HTMLElement> & {
    nodeProps: {
      node: DocNode;
      getPos: () => number;
      contentDOMRef: RefCallback<Element>;
    };
    children: ReactNode;
  } & RefAttributes<E>;

/**
 * What `createShape` returns: for `Decoration.Tag.shape`, a node's shape, its root the node type's
 * own outer element, an atom where the type's shape is. `of` gives the shape with `element` for its
 * root: for `Decoration.Point.shape`, or a root other than the type's.
 */
export type ReactShape = ComponentShape;

type DrawProps = {
  attrs: HTMLProps<HTMLElement>;
  nodeProps: ShapeComponentProps["nodeProps"];
  children: ReactNode;
  ref: RefCallback<Element>;
};

const draws = new Map<string, (props: DrawProps) => ReactElement>();

// By component: calling createShape again with one gives the same shape, so
// Wordgard sees no configuration change and the registry doesn't grow.
const shapes = new WeakMap<object, ReactShape>();

/**
 * A node's shape, for `Decoration.Tag.shape(NodeType, shape)`. `shape.of(element)` is the shape
 * with another root element, also for `Decoration.Point.shape`.
 */
export const createShape = <E extends Element = HTMLElement>(
  component: ComponentType<ShapeComponentProps<E>>
): ReactShape => {
  const found = shapes.get(component);
  if (found) return found;
  const { id, shape } = defineShape();
  draws.set(id, ({ attrs, nodeProps, children, ref }) =>
    createElement(component, {
      ...attrs,
      ref: takesRef(component) ? ref : undefined,
      nodeProps,
      children,
    })
  );
  shapes.set(component, shape);
  return shape;
};

export const drawShape = (elt: Elt<unknown>, props: DrawProps) => {
  const draw = draws.get(idOf(elt) ?? "");
  if (!draw) throw new Error("Not a React shape");
  return draw(props);
};
