// Adapted from react-wordgard's ReactWrapperType.ts for Vue: a Vue wrapper is a real Wordgard
// `Elt` with a hole (src/decorations/wrapperType.ts), registered as drawn by a component, which
// draws what it wraps as a WrappedNode.
import type { Component } from "vue";
import type { Node as DocNode, Elt } from "wordgard/doc";

import { idOf } from "../../../src/decorations/shapeType.js";
import { defineWrapper } from "../../../src/decorations/wrapperType.js";

/** A Vue wrapper's props, as a shape's. What it wraps is a `WrappedNode`. */
export type WrapperComponentProps = {
  nodeProps: {
    node: DocNode;
    getPos: () => number;
  };
};

/** `createWrapper`'s options. */
export type WrapperOptions = {
  /**
   * The component's root element, `div` by default: `target` selectors match it, and plain Wordgard
   * draws it. `span` around an inline node.
   */
  element?: string;
};

const components = new Map<string, Component>();

// By component, then root element, as Vue shapes are.
const wrappers = new WeakMap<Component, ReturnType<typeof defineWrapper>>();

/** A wrapper, for `Decoration.Tag.wrapper` and `Decoration.Point.wrapper`. */
export const createWrapper = (
  component: Component,
  { element = "div" }: WrapperOptions = {}
): Elt => {
  let registered = wrappers.get(component);
  if (!registered) {
    registered = defineWrapper();
    components.set(registered.id, component);
    wrappers.set(component, registered);
  }
  return registered.elt(element);
};

export const wrapperComponent = (elt: Elt<unknown>) => {
  const component = components.get(idOf(elt) ?? "");
  if (!component) throw new Error("Not a Vue wrapper");
  return component;
};
