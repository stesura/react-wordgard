// Named after react-prosemirror's ReactWidgetType, rewritten for Wordgard: a
// React widget type is a real Wordgard widget type, made by Widget.define with
// the same spec, drawn by its component in the editor's own React tree. As
// in react-prosemirror, the component forwards its ref to its root element,
// which becomes the widget's DOM. Wordgard ignores what the component changes
// inside that element, so it may re-render on its own, but not swap the
// element itself: the parent's tile would put the old one back. An editable
// one the user edits keeps the edit, where Wordgard would redraw it.
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
import { reserved } from "./ReactShapeType.js";

// A widget drawing a node also gets the node's attributes (the selected-node
// class, tag and mark attributes) as props, for its root element.
// (`value` is the widget's.)
export type WidgetComponentProps<Param, E extends Element = HTMLElement> = Omit<
  AllHTMLAttributes<HTMLElement>,
  "value"
> & {
  value: Param;
} & RefAttributes<E>;

export type WidgetTypeSpec<Param, E extends Element = HTMLElement> = Omit<
  Widget.Spec<Param>,
  "render"
> & {
  component: ComponentType<WidgetComponentProps<Param, E>>;
};

type Draw = (
  widget: Widget,
  ref: RefCallback<Element>,
  attrs: HTMLProps<HTMLElement>
) => ReactElement | null;

const components = new WeakMap<Widget.Type<unknown>, Draw>();

// Widget.define needs a `render`, which ReactWordgard never calls: only plain
// Wordgard, given a React widget, draws this.
const placeholder = () => document.createElement("span");

export const createWidgetType = <Param, E extends Element = HTMLElement>(
  spec: WidgetTypeSpec<Param, E>
): Widget.Type<Param> => createWidgetTypeWithRender({ ...spec, render: placeholder });

// For the tests comparing ReactWordgard with plain Wordgard, which draws
// `render`.
export const createWidgetTypeWithRender = <Param, E extends Element = HTMLElement>(
  spec: WidgetTypeSpec<Param, E> & Pick<Widget.Spec<Param>, "render">
): Widget.Type<Param> => {
  const { propagateEvent } = spec;
  // Its components' useStopEvent first, then the spec's.
  const type = Widget.define<Param>({
    ...spec,
    propagateEvent: (event) =>
      !stopsEvent(event) &&
      (typeof propagateEvent == "function" ? propagateEvent(event) : propagateEvent !== false),
  });
  // A type guard, not checked by the compiler: a widget of `type` was made by
  // `type.of`, so its value is a Param.
  const own = (widget: Widget): widget is Widget<Param> => widget.type == type;
  components.set(type, (widget, ref, attrs) =>
    own(widget) ? createElement(spec.component, { ...attrs, value: widget.value, ref }) : null
  );
  return type;
};

export const isReactWidget = (widget: Widget) => components.has(widget.type);

// The widget's component, its ref on the root element.
export const drawWidget = (
  widget: Widget,
  ref: RefCallback<Element>,
  attrs: HTMLProps<HTMLElement> = {}
) => components.get(widget.type)?.(widget, ref, attrs) ?? null;

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
