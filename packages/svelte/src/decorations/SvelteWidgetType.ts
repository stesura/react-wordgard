// Adapted from react-wordgard's ReactWidgetType.ts (by way of vue-wordgard's VueWidgetType.ts) for
// Svelte: a real Wordgard widget type (the core's decorations/widgetType.ts), drawn by its
// component. Its root is the widget's DOM.
import type { Component } from "svelte";
import type { Widget } from "wordgard/editor";

import { defineWidgetType } from "@stesura/wordgard-view";
import type { AnyComponent } from "../helpers/mountRoot.js";

/** A Svelte widget's props: its value, and the attributes of a node it draws, for its root. */
export type WidgetComponentProps<Param> = {
  value: Param;
  [attribute: string]: unknown;
};

/** `createWidgetType`'s spec: Wordgard's widget spec, with a component in place of `render`. */
export type WidgetTypeSpec<Param> = Omit<Widget.Spec<Param>, "render"> & {
  component: Component<WidgetComponentProps<Param>>;
  /**
   * The root `DecorationRoot` draws in the component, `span` by default. Wordgard doesn't look at a
   * widget's element, so it's the component's choice.
   */
  element?: string;
};

const components = new WeakMap<
  Widget.Type<unknown>,
  { component: AnyComponent; element: string }
>();

// Widget.define needs a `render`, which SvelteWordgard never calls: only plain
// Wordgard, given a Svelte widget, draws this.
const placeholder = () => document.createElement("span");

/** A widget type whose widgets, `type.of(value)`, the component draws. */
export const createWidgetType = <Param>(spec: WidgetTypeSpec<Param>): Widget.Type<Param> =>
  createWidgetTypeWithRender({ ...spec, render: placeholder });

// For the tests comparing SvelteWordgard with plain Wordgard, which draws
// `render`.
export const createWidgetTypeWithRender = <Param>({
  component,
  element = "span",
  ...spec
}: WidgetTypeSpec<Param> & Pick<Widget.Spec<Param>, "render">): Widget.Type<Param> => {
  const type = defineWidgetType<Param>(spec);
  components.set(type, { component, element });
  return type;
};

export const widgetComponent = (widget: Widget) => {
  const found = components.get(widget.type);
  if (!found) throw new Error("Not a Svelte widget");
  return found;
};
