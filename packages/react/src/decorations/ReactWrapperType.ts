// Named after ReactWidgetType. A React wrapper is a real Wordgard `Elt` with a hole
// (wrapperType.ts), registered as drawn by a component.
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
import { defineWrapper, idOf } from "@stesura/wordgard-view";

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

const draws = new Map<string, (props: DrawProps) => ReactElement>();

// By component, then root element, as React shapes are.
const wrappers = new WeakMap<object, ReturnType<typeof defineWrapper>>();

/** A wrapper, for `Decoration.Tag.wrapper` and `Decoration.Point.wrapper`. */
export const createWrapper = <E extends Element = HTMLElement>(
  component: ComponentType<WrapperComponentProps<E>>,
  { element = "div" }: WrapperOptions = {}
): Elt => {
  let registered = wrappers.get(component);
  if (!registered) {
    registered = defineWrapper();
    draws.set(registered.id, ({ attrs, nodeProps, children, ref }) =>
      createElement(component, {
        ...attrs,
        ref: takesRef(component) ? ref : undefined,
        nodeProps,
        children,
      })
    );
    wrappers.set(component, registered);
  }
  return registered.elt(element);
};

export const drawWrapper = (elt: Elt<unknown>, props: DrawProps) => {
  const draw = draws.get(idOf(elt) ?? "");
  if (!draw) throw new Error("Not a React wrapper");
  return draw(props);
};
