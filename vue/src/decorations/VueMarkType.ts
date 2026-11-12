// Adapted from react-wordgard's ReactMarkType.ts for Vue: a Vue mark is a mark's element shape
// (src/decorations/markType.ts), registered as drawn by a component, its content a NodeContent.
import type { Component } from "vue";
import type { Elt, Mark } from "wordgard/doc";

import { type MarkShape, defineMarkShape } from "../../../src/decorations/markType.js";
import { idOf } from "../../../src/decorations/shapeType.js";

/** A Vue mark's props, for each run of an equal mark: `markProps.mark` is the document's mark. */
export type MarkComponentProps = {
  markProps: {
    mark: Mark;
    getPos: () => number;
  };
};

/** `createMarkShape`'s options. */
export type MarkShapeOptions = {
  /**
   * The component's root element, `span` by default, which plain Wordgard draws. It can't come from
   * the mark type: a mark type's own `shape` is written before the type exists.
   */
  element?: string;
};

const components = new Map<string, Component>();

// By component, then root element, as Vue shapes are.
const marks = new WeakMap<Component, ReturnType<typeof defineMarkShape>>();

/** A mark's shape, for `Decoration.Mark.shape(MarkType, shape)` or a mark type's own `shape`. */
export const createMarkShape = (
  component: Component,
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
  if (!component) throw new Error("Not a Vue mark");
  return component;
};
