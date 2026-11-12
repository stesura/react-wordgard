// Named after ReactWidgetType. A React mark is a mark's element shape (markType.ts), registered as
// drawn by a component. The props follow react-prosemirror's MarkComponentProps.
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
import { type MarkShape, defineMarkShape, idOf } from "@stesura/wordgard-view";

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

const draws = new Map<string, (props: DrawProps) => ReactElement>();

// By component, then root element, as React shapes are.
const marks = new WeakMap<object, ReturnType<typeof defineMarkShape>>();

/**
 * A mark's shape, for `Decoration.Mark.shape(MarkType, shape)` or a mark type's own `shape`.
 */
export const createMarkShape = <E extends Element = HTMLElement>(
  component: ComponentType<MarkComponentProps<E>>,
  { element = "span" }: MarkShapeOptions = {}
): MarkShape => {
  let registered = marks.get(component);
  if (!registered) {
    registered = defineMarkShape();
    draws.set(registered.id, ({ attrs, markProps, children, ref }) =>
      createElement(component, {
        ...attrs,
        ref: takesRef(component) ? ref : undefined,
        markProps,
        children,
      })
    );
    marks.set(component, registered);
  }
  return registered.shape(element);
};

export const drawMark = (elt: Elt<unknown>, props: DrawProps) => {
  const draw = draws.get(idOf(elt) ?? "");
  if (!draw) throw new Error("Not a React mark");
  return draw(props);
};
