// Adapted from react-wordgard's ReactWrapperType.ts (by way of vue-wordgard's VueWrapperType.ts)
// for Svelte: a Svelte wrapper is a real Wordgard `Elt` with a hole (the core's
// decorations/wrapperType.ts), registered as drawn by a component.
import type { Component } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { Node as DocNode, Elt } from "wordgard/doc";

import { defineWrapper, idOf } from "@stesura/wordgard-view";
import type { AnyComponent } from "../helpers/mountRoot.js";

/**
 * A Svelte wrapper's props, as a shape's, with `wrappedDOMRef` in place of `contentDOMRef`: the
 * element it's attached to gets what's wrapped as its first child.
 */
export type WrapperComponentProps = {
  nodeProps: {
    node: DocNode;
    getPos: () => number;
  };
  wrappedDOMRef: Attachment<Element>;
  [attribute: string]: unknown;
};

/** `createWrapper`'s options. */
export type WrapperOptions = {
  /**
   * The component's root element, `div` by default: `target` selectors match it, and plain Wordgard
   * draws it. `span` around an inline node.
   */
  element?: string;
};

const components = new Map<string, AnyComponent>();

const wrappers = new WeakMap<AnyComponent, ReturnType<typeof defineWrapper>>();

/** A wrapper, for `Decoration.Tag.wrapper` and `Decoration.Point.wrapper`. */
export const createWrapper = (
  component: Component<WrapperComponentProps>,
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
  if (!component) throw new Error("Not a Svelte wrapper");
  return component;
};
