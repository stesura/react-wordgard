// Named after ReactWidgetType: a React wrapper is a real Wordgard `Elt` with a
// hole, the wrapper plain Wordgard draws (`Decoration.Tag.wrapper`,
// `Decoration.Point.wrapper`), registered as drawn by a component, which
// renders what it wraps as `children`. Registered as React shapes are (the
// reserved attribute); its props are a React shape's without `contentDOMRef`:
// `children` goes where the hole is.
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

import { idOf, reserved } from "./ReactShapeType.js";

export type WrapperViewComponentProps<E extends Element = HTMLElement> =
  AllHTMLAttributes<HTMLElement> & {
    nodeProps: {
      node: DocNode;
      getPos: () => number;
    };
    children: ReactNode;
  } & RefAttributes<E>;

export type WrapperSpec<E extends Element = HTMLElement> = {
  component: ComponentType<WrapperViewComponentProps<E>>;
  // The component's root element: `target` selectors match it, and plain
  // Wordgard draws it. `span` around an inline node.
  element?: string;
};

type DrawProps = {
  attrs: HTMLProps<HTMLElement>;
  nodeProps: WrapperViewComponentProps["nodeProps"];
  children: ReactNode;
  ref: RefCallback<Element>;
};

// Keyed apart from React shapes' ids, which share the attribute.
const draws = new Map<string, (props: DrawProps) => ReactElement>();

export const createWrapper = <E extends Element = HTMLElement>({
  component,
  element = "div",
}: WrapperSpec<E>): Elt => {
  const id = `w${draws.size + 1}`;
  draws.set(id, ({ attrs, nodeProps, children, ref }) =>
    createElement(component, { ...attrs, ref, nodeProps, children })
  );
  return Elt.mk(element, { [reserved]: id }, [0]);
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
