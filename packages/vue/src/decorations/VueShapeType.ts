// Adapted from react-wordgard's ReactShapeType.ts for Vue: a Vue shape is a real Wordgard `Elt`
// (the core's decorations/shapeType.ts), registered as drawn by a component. Wordgard's attributes
// fall through to the component's root, so there's no ref to forward; its content is a NodeContent.
import type { Component } from "vue";
import type { Node as DocNode, Elt } from "wordgard/doc";

import { type ComponentShape, defineShape, idOf } from "@stesura/wordgard-view";

/**
 * A Vue shape's props, besides Wordgard's attributes, which fall through to its root: the node,
 * and its position (to call in handlers and effects). Its content goes in a `NodeContent`.
 */
export type ShapeComponentProps = {
  nodeProps: {
    node: DocNode;
    getPos: () => number;
  };
};

/**
 * What `createShape` returns: for `Decoration.Tag.shape`, a node's shape, its root the node type's
 * own outer element, an atom where the type's shape is. `of` gives the shape with `element` for its
 * root: for `Decoration.Point.shape`, or a root other than the type's.
 */
export type VueShape = ComponentShape;

const components = new Map<string, Component>();

// By component: calling createShape again with one gives the same shape, so
// Wordgard sees no configuration change and the registry doesn't grow.
const shapes = new WeakMap<Component, VueShape>();

/**
 * A node's shape, for `Decoration.Tag.shape(NodeType, shape)`. `shape.of(element)` is the shape
 * with another root element, also for `Decoration.Point.shape`. The component declares the
 * `nodeProps` prop.
 */
export const createShape = (component: Component): VueShape => {
  const found = shapes.get(component);
  if (found) return found;
  const { id, shape } = defineShape();
  components.set(id, component);
  shapes.set(component, shape);
  return shape;
};

export const shapeComponent = (elt: Elt<unknown>) => {
  const component = components.get(idOf(elt) ?? "");
  if (!component) throw new Error("Not a Vue shape");
  return component;
};
