// Named after ReactWidgetType. A React wrapper is a real Wordgard `Elt` with a hole, registered as
// React shapes are (the reserved attribute).
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
import { type Node as DocNode, Elt } from "wordgard/doc";

import { takesRef } from "../helpers/refs.js";
import { idOf, reserved } from "./ReactShapeType.js";

/**
 * A React wrapper's props: as a shape's, without `contentDOMRef`. `children` is what it wraps.
 */
export type WrapperComponentProps<E extends Element = HTMLElement> =
  AllHTMLAttributes<HTMLElement> & {
    nodeProps: {
      node: DocNode;
      getPos: () => number;
    };
    children: ReactNode;
  } & RefAttributes<E>;

/** `createWrapper`'s options. */
export type WrapperOptions = {
  /**
   * The component's root element, `div` by default: `target` selectors match it, and plain Wordgard
   * draws it. `span` around an inline node.
   */
  element?: string;
};

type DrawProps = {
  attrs: HTMLProps<HTMLElement>;
  nodeProps: WrapperComponentProps["nodeProps"];
  children: ReactNode;
  ref: RefCallback<Element>;
};

// Keyed apart from React shapes' ids, which share the attribute.
const draws = new Map<string, (props: DrawProps) => ReactElement>();

// By component, then root element, as React shapes are.
const wrappers = new WeakMap<object, { id: string; elts: Map<string, Elt> }>();

/** A wrapper, for `Decoration.Tag.wrapper` and `Decoration.Point.wrapper`. */
export const createWrapper = <E extends Element = HTMLElement>(
  component: ComponentType<WrapperComponentProps<E>>,
  { element = "div" }: WrapperOptions = {}
): Elt => {
  let registered = wrappers.get(component);
  if (!registered) {
    const id = `w${draws.size + 1}`;
    draws.set(id, ({ attrs, nodeProps, children, ref }) =>
      createElement(component, {
        ...attrs,
        ref: takesRef(component) ? ref : undefined,
        nodeProps,
        children,
      })
    );
    registered = { id, elts: new Map() };
    wrappers.set(component, registered);
  }
  let elt = registered.elts.get(element);
  if (!elt) {
    elt = Elt.mk(element, { [reserved]: registered.id }, [0]);
    registered.elts.set(element, elt);
  }
  return elt;
};

export const isReactWrapper = (elt: Elt<unknown>) => {
  const id = idOf(elt);
  return id != null && draws.has(id);
};

export const drawWrapper = (elt: Elt<unknown>, props: DrawProps) => {
  const draw = draws.get(idOf(elt) ?? "");
  if (!draw) throw new Error("Not a React wrapper");
  return draw(props);
};
