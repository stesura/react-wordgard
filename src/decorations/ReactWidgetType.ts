// Named after react-prosemirror's ReactWidgetType, rewritten for Wordgard: a real Wordgard widget
// type (Widget.define, same spec), drawn by its component in the editor's React tree. Its root,
// which the component forwards its ref to, is the widget's DOM: the component may re-render inside
// it, but not swap it, or the parent's tile puts the old one back. An editable one the user edits
// keeps the edit, where Wordgard would redraw it.
import {
  type AllHTMLAttributes,
  type ComponentType,
  type HTMLProps,
  type ReactElement,
  type RefAttributes,
  type RefCallback,
  createElement,
} from "react";
import { Attributes, Elt } from "wordgard/doc";
import { Widget } from "wordgard/editor";

import { stopsEvent } from "../contexts/DecorationContext.js";
import { takesRef } from "../helpers/refs.js";
import { reserved } from "./ReactShapeType.js";

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
  const { component, element = "span", propagateEvent, ...widgetSpec } = spec;
  // Its components' useStopEvent first, then the spec's.
  const type = Widget.define<Param>({
    ...widgetSpec,
    propagateEvent: (event) =>
      !stopsEvent(event) &&
      (typeof propagateEvent == "function" ? propagateEvent(event) : propagateEvent !== false),
  });
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

export const isReactWidget = (widget: Widget) => components.has(widget.type);

// The widget's component, its ref on the root element.
export const drawWidget = (
  widget: Widget,
  ref: RefCallback<Element>,
  attrs: HTMLProps<HTMLElement> = {}
) => components.get(widget.type)?.draw(widget, ref, attrs) ?? null;

// The root a React widget's DecorationRoot draws.
export const widgetElement = (widget: Widget) => components.get(widget.type)?.element ?? "span";

// Wordgard adds attributes to a widget-drawn node by wrapping the widget in an
// element. Around a React widget, that element is marked: the view draws the
// widget alone, the attributes as props, so a selection (the class it adds)
// doesn't move the component under a new parent, which would remount it. The
// marked element still merges later attributes and takes wrappers, as
// Wordgard's.
const attributed = "widget";

export const attributeWidget = (widget: Widget, attrs: Attributes, tagName: string) =>
  Elt.create(
    tagName,
    isReactWidget(widget) ? Attributes.merge(attrs, [reserved, attributed]) : attrs,
    [widget]
  );

// The React widget a marked element holds, its attributes being the widget's.
export const attributedWidget = (elt: Elt<unknown>) => {
  const [widget] = elt.children;
  return Attributes.get(elt.attrs, reserved) == attributed && widget instanceof Widget
    ? widget
    : null;
};

// The root elements React widgets forwarded their ref to, for ReactDocTile to
// check it got the widget's DOM.
export const widgetRoots = new WeakSet<Element>();

export const widgetRoot = (dom: Element | null) => {
  if (dom) widgetRoots.add(dom);
};
