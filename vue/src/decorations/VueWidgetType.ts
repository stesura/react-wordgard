// Adapted from react-wordgard's ReactWidgetType.ts for Vue: a real Wordgard widget type
// (src/decorations/widgetType.ts), drawn by its component in the editor's Vue tree. Its root is the
// widget's DOM: the component may re-render inside it, but not swap it.
import { type Component, h } from "vue";
import type { Widget } from "wordgard/editor";

import { defineWidgetType } from "../../../src/decorations/widgetType.js";

/** A Vue widget's props, besides the attributes of a node it draws, which fall through. */
export type WidgetComponentProps<Param> = {
  value: Param;
};

/** `createWidgetType`'s spec: Wordgard's widget spec, with a component in place of `render`. */
export type WidgetTypeSpec<Param> = Omit<Widget.Spec<Param>, "render"> & {
  /** Declares the `value` prop. */
  component: Component;
  /**
   * The root `DecorationRoot` draws in the component, `span` by default. Wordgard doesn't look at a
   * widget's element, so it's the component's choice.
   */
  element?: string;
};

const components = new WeakMap<Widget.Type<unknown>, { component: Component; element: string }>();

// Widget.define needs a `render`, which VueWordgard never calls: only plain
// Wordgard, given a Vue widget, draws this.
const placeholder = () => document.createElement("span");

/** A widget type whose widgets, `type.of(value)`, the component draws. */
export const createWidgetType = <Param>({
  component,
  element = "span",
  ...spec
}: WidgetTypeSpec<Param>): Widget.Type<Param> => {
  const type = defineWidgetType<Param>({ ...spec, render: placeholder });
  components.set(type, { component, element });
  return type;
};

// The widget's component, with `attrs` for its root.
export const drawWidget = (widget: Widget, attrs: Record<string, string>) => {
  const found = components.get(widget.type);
  return found ? h(found.component, { ...attrs, value: widget.value }) : null;
};

// The root a Vue widget's DecorationRoot draws.
export const widgetElement = (widget: Widget) => components.get(widget.type)?.element ?? "span";
