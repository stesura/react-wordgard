// Named after react-prosemirror's ReactWidgetType, rewritten for Wordgard: a real Wordgard widget
// type (widgetType.ts), drawn by its component in the editor's React tree. Its root, which the
// component forwards its ref to, is the widget's DOM: the component may re-render inside it, but
// not swap it, or the parent's tile puts the old one back. An editable one the user edits keeps the
// edit, where Wordgard would redraw it.
import {
  type AllHTMLAttributes,
  type ComponentType,
  type HTMLProps,
  type ReactElement,
  type RefAttributes,
  type RefCallback,
  createElement,
} from "react";
import type { Widget } from "wordgard/editor";

import { takesRef } from "../helpers/refs.js";
import { defineWidgetType } from "@stesura/wordgard-view";

/**
 * A React widget's props: its `value`, and, for a widget drawing a node, the node's attributes for
 * its root.
 */
export type WidgetComponentProps<Param, E extends Element = HTMLElement> = Omit<
  AllHTMLAttributes<HTMLElement>,
  "value"
> & {
  value: Param;
} & RefAttributes<E>;

/** `createWidgetType`'s spec: Wordgard's widget spec, with a component in place of `render`. */
export type WidgetTypeSpec<Param, E extends Element = HTMLElement> = Omit<
  Widget.Spec<Param>,
  "render"
> & {
  component: ComponentType<WidgetComponentProps<Param, E>>;
  /**
   * The root `DecorationRoot` draws in the component, `span` by default. Wordgard doesn't look at a
   * widget's element, so it's the component's choice.
   */
  element?: string;
};

type Draw = (
  widget: Widget,
  ref: RefCallback<Element>,
  attrs: HTMLProps<HTMLElement>
) => ReactElement | null;

const components = new WeakMap<Widget.Type<unknown>, { draw: Draw; element: string }>();

// Widget.define needs a `render`, which ReactWordgard never calls: only plain
// Wordgard, given a React widget, draws this.
const placeholder = () => document.createElement("span");

/** A widget type whose widgets, `type.of(value)`, the component draws. */
export const createWidgetType = <Param, E extends Element = HTMLElement>(
  spec: WidgetTypeSpec<Param, E>
): Widget.Type<Param> => createWidgetTypeWithRender({ ...spec, render: placeholder });

// For the tests comparing ReactWordgard with plain Wordgard, which draws
// `render`.
export const createWidgetTypeWithRender = <Param, E extends Element = HTMLElement>(
  spec: WidgetTypeSpec<Param, E> & Pick<Widget.Spec<Param>, "render">
): Widget.Type<Param> => {
  const { component, element = "span", ...widgetSpec } = spec;
  const type = defineWidgetType<Param>(widgetSpec);
  // A type guard, not checked by the compiler: a widget of `type` was made by
  // `type.of`, so its value is a Param.
  const own = (widget: Widget): widget is Widget<Param> => widget.type == type;
  const draw: Draw = (widget, ref, attrs) =>
    own(widget)
      ? createElement(component, {
          ...attrs,
          value: widget.value,
          ref: takesRef(component) ? ref : undefined,
        })
      : null;
  components.set(type, { draw, element });
  return type;
};

// The widget's component, its ref on the root element.
export const drawWidget = (
  widget: Widget,
  ref: RefCallback<Element>,
  attrs: HTMLProps<HTMLElement> = {}
) => components.get(widget.type)?.draw(widget, ref, attrs) ?? null;

// The root a React widget's DecorationRoot draws.
export const widgetElement = (widget: Widget) => components.get(widget.type)?.element ?? "span";
