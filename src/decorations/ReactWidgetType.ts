// Named after react-prosemirror's ReactWidgetType, rewritten for Wordgard: a
// React widget type is a real Wordgard widget type, made by Widget.define with
// the same spec, whose `render` is the fallback plain Wordgard draws. The
// React view draws its component instead, in the editor's own React tree. As
// in react-prosemirror, the component forwards its ref to its root element,
// which becomes the widget's DOM. Wordgard ignores what the component changes
// inside that element, so it may re-render on its own, but not swap the
// element itself: the parent's tile would put the old one back. An editable
// one the user edits keeps the edit, where Wordgard would redraw it.
import {
  type ComponentType,
  type ReactElement,
  type RefAttributes,
  type RefCallback,
  createElement,
} from "react";
import { Widget } from "wordgard/editor";

export type WidgetViewComponentProps<Param, E extends Element = HTMLElement> = {
  value: Param;
} & RefAttributes<E>;

export type ReactWidgetSpec<Param, E extends Element = HTMLElement> = Widget.Spec<Param> & {
  component: ComponentType<WidgetViewComponentProps<Param, E>>;
};

type Draw = (widget: Widget, ref: RefCallback<Element>) => ReactElement | null;

const components = new WeakMap<Widget.Type<unknown>, Draw>();

export const reactWidget = <Param, E extends Element = HTMLElement>(
  spec: ReactWidgetSpec<Param, E>
): Widget.Type<Param> => {
  const type = Widget.define<Param>(spec);
  // A type guard, not checked by the compiler: a widget of `type` was made by
  // `type.of`, so its value is a Param.
  const own = (widget: Widget): widget is Widget<Param> => widget.type == type;
  components.set(type, (widget, ref) =>
    own(widget) ? createElement(spec.component, { value: widget.value, ref }) : null
  );
  return type;
};

export const isReactWidget = (widget: Widget) => components.has(widget.type);

// The widget's component, its ref on the root element.
export const drawWidget = (widget: Widget, ref: RefCallback<Element>) =>
  components.get(widget.type)?.(widget, ref) ?? null;
