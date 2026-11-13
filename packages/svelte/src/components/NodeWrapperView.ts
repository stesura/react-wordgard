// Not in react-wordgard, whose DefaultNodeView nests a node's wrappers as elements, each given the
// next as `children`; adapted from vue-wordgard's NodeWrapperView, which hands each the next. A
// Svelte node wrapper is a component mounted on its own (helpers/mountRoot.ts), drawing nothing in
// the document: its WrappedNode hands the next wrapper, then the node, its contexts, and the
// node's root its attributes.
import { Attributes, type Node } from "wordgard/doc";

import { DecorationKey } from "../contexts/DecorationContext.js";
import { type WrappedContextValue, WrappedKey } from "../contexts/WrappedContext.js";
import type { AnyComponent, Bare } from "../helpers/mountRoot.js";
import type { DrawContext } from "./ChildNodeViews.js";

export type NodeProps = { readonly node: Node; readonly getPos: () => number };

export type Wrapping = {
  readonly components: readonly AnyComponent[];
  // What the node is drawn with: the innermost WrappedNode's.
  readonly contexts: Map<unknown, unknown>;
  // The attributes the wrappers give the node's root, the outermost's winning.
  readonly attributes: () => Attributes;
  readonly update: (nodeProps: NodeProps) => void;
  readonly destroy: () => void;
};

// A `class` as Svelte takes it on an element: a string, or arrays and objects
// of them (its clsx).
const classOf = (value: unknown): string => {
  if (typeof value == "string" || typeof value == "number") return String(value);
  if (Array.isArray(value)) return value.map(classOf).filter(Boolean).join(" ");
  if (value && typeof value == "object")
    return Object.entries(value)
      .filter(([, on]) => on)
      .map(([name]) => name)
      .join(" ");
  return "";
};

// A WrappedNode's props as attributes: those without a value dropped, and
// what no attribute holds (handlers, attachments): it draws no element.
const toAttributes = (props: Record<string, unknown>) => {
  const record: Record<string, string> = {};
  for (const [name, value] of Object.entries(props)) {
    if (value == null || value === false || typeof value == "function") continue;
    if (name == "class") {
      const classes = classOf(value);
      if (classes) record[name] = classes;
    } else if (typeof value != "object") record[name] = value === true ? "" : String(value);
  }
  return Attributes.read(record);
};

type Level = {
  readonly component: AnyComponent;
  readonly bare: Bare;
  readonly found: { attributes: () => Record<string, unknown> };
};

// Mounts `components` around a node, the first outermost. `changed` hears a
// WrappedNode's attributes change.
export const NodeWrapperView = (
  components: readonly AnyComponent[],
  nodeProps: NodeProps,
  context: DrawContext,
  changed: () => void
): Wrapping => {
  const levels: Level[] = [];
  const destroy = () => {
    for (const level of levels.splice(0).reverse()) level.bare.destroy();
  };
  // Not before every wrapper is mounted: a change heard then would draw the
  // node, and so mount its wrappers, again.
  let ready = false;
  const heard = () => {
    if (ready) changed();
  };
  let contexts = context.contexts;
  try {
    for (const component of components) {
      const found: { contexts: Map<unknown, unknown> | null } & Level["found"] = {
        contexts: null,
        attributes: () => ({}),
      };
      const wrapped: WrappedContextValue = {
        wrap: (inner, attributes) => {
          found.contexts = inner;
          found.attributes = attributes;
        },
        changed: heard,
      };
      const given = new Map(contexts);
      given.set(WrappedKey, wrapped);
      // A node wrapper isn't a decoration.
      given.set(DecorationKey, null);
      const bare = context.holder.mountBare({ component, props: { nodeProps } }, given, (error) => {
        console.error(error);
        context.failed(error);
      });
      levels.push({ component, bare, found });
      if (!found.contexts)
        throw new Error(
          `A ${context.words.name} node wrapper's component must draw a WrappedNode (one that threw as it was set up draws none: its error is logged next)`
        );
      contexts = found.contexts;
    }
  } catch (error) {
    // Not before a wrapper that threw in its setup has its boundary report
    // the error, a microtask later.
    queueMicrotask(destroy);
    throw error;
  }
  ready = true;
  const inner = new Map(contexts);
  // What the node draws isn't a node wrapper.
  inner.set(WrappedKey, null);
  return {
    components,
    contexts: inner,
    attributes: () =>
      levels.reduceRight(
        (attrs, { found }) => Attributes.merge(attrs, toAttributes(found.attributes())),
        Attributes.none
      ),
    update: (next) => {
      for (const { component, bare } of levels)
        bare.drawn.current = { component, props: { nodeProps: next } };
    },
    destroy,
  };
};
