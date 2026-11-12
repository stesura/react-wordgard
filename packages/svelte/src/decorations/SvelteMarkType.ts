// Adapted from react-wordgard's ReactMarkType.ts (by way of vue-wordgard's VueMarkType.ts) for
// Svelte: a Svelte mark is a mark's element shape (the core's decorations/markType.ts), registered
// as drawn by a component.
import type { Component } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { Elt, Mark } from "wordgard/doc";

import { type MarkShape, defineMarkShape, idOf } from "@stesura/wordgard-view";
import type { AnyComponent } from "../helpers/mountRoot.js";

/**
 * A Svelte mark's props, for each run of an equal mark: `markProps.mark` is the document's mark.
 * `contentDOMRef` marks the content element; without it, the root holds the content.
 */
export type MarkComponentProps = {
  markProps: {
    mark: Mark;
    getPos: () => number;
  };
  contentDOMRef: Attachment<Element>;
  [attribute: string]: unknown;
};

/** `createMarkShape`'s options. */
export type MarkShapeOptions = {
  /**
   * The component's root element, `span` by default, which plain Wordgard draws. It can't come from
   * the mark type: a mark type's own `shape` is written before the type exists.
   */
  element?: string;
};

const components = new Map<string, AnyComponent>();

const marks = new WeakMap<AnyComponent, ReturnType<typeof defineMarkShape>>();

/** A mark's shape, for `Decoration.Mark.shape(MarkType, shape)` or a mark type's own `shape`. */
export const createMarkShape = (
  component: Component<MarkComponentProps>,
  { element = "span" }: MarkShapeOptions = {}
): MarkShape => {
  let registered = marks.get(component);
  if (!registered) {
    registered = defineMarkShape();
    components.set(registered.id, component);
    marks.set(component, registered);
  }
  return registered.shape(element);
};

export const markComponent = (elt: Elt<unknown>) => {
  const component = components.get(idOf(elt) ?? "");
  if (!component) throw new Error("Not a Svelte mark");
  return component;
};
