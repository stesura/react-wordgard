// Adapted from react-wordgard's ReactShapeType.ts (by way of vue-wordgard's VueShapeType.ts) for
// Svelte: a Svelte shape is a real Wordgard `Elt` (the core's decorations/shapeType.ts), registered
// as drawn by a component.
import type { Component } from "svelte";
import type { Attachment } from "svelte/attachments";
import type { Node as DocNode, Elt } from "wordgard/doc";

import { type ComponentShape, defineShape, idOf } from "@stesura/wordgard-view";
import type { AnyComponent } from "../helpers/mountRoot.js";

/**
 * A Svelte shape's props: the node and its position (to call in handlers and effects),
 * `contentDOMRef` to attach to the content element (left empty: the node's content goes there),
 * and Wordgard's attributes, to spread on the root (`{...rest}`).
 */
export type ShapeComponentProps = {
  nodeProps: {
    node: DocNode;
    getPos: () => number;
  };
  contentDOMRef: Attachment<Element>;
  [attribute: string]: unknown;
};

/**
 * What `createShape` returns: for `Decoration.Tag.shape`, a node's shape, its root the node type's
 * own outer element, an atom where the type's shape is. `of` gives the shape with `element` for its
 * root: for `Decoration.Point.shape`, or a root other than the type's.
 */
export type SvelteShape = ComponentShape;

const components = new Map<string, AnyComponent>();

// By component: calling createShape again with one gives the same shape, so
// Wordgard sees no configuration change and the registry doesn't grow.
const shapes = new WeakMap<AnyComponent, SvelteShape>();

/**
 * A node's shape, for `Decoration.Tag.shape(NodeType, shape)`. `shape.of(element)` is the shape
 * with another root element, also for `Decoration.Point.shape`.
 */
export const createShape = (component: Component<ShapeComponentProps>): SvelteShape => {
  const found = shapes.get(component);
  if (found) return found;
  const { id, shape } = defineShape();
  components.set(id, component);
  shapes.set(component, shape);
  return shape;
};

export const shapeComponent = (elt: Elt<unknown>) => {
  const component = components.get(idOf(elt) ?? "");
  if (!component) throw new Error("Not a Svelte shape");
  return component;
};
