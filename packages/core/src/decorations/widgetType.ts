// Split from ReactWidgetType.ts, without React: a widget type a component draws is a real Wordgard
// widget type (Widget.define, same spec). Its root, which the component gives the view, is the
// widget's DOM.
import { Attributes, Elt } from "wordgard/doc";
import { Widget } from "wordgard/editor";

import { stopsEvent } from "./decorationHandlers.js";
import { reserved } from "./shapeType.js";

const drawn = new WeakSet<Widget.Type<unknown>>();

// A widget type a component draws: its components' useStopEvent are asked
// first, then the spec's `propagateEvent`.
export const defineWidgetType = <Param>({
  propagateEvent,
  ...spec
}: Widget.Spec<Param>): Widget.Type<Param> => {
  const type = Widget.define<Param>({
    ...spec,
    propagateEvent: (event) =>
      !stopsEvent(event) &&
      (typeof propagateEvent == "function" ? propagateEvent(event) : propagateEvent !== false),
  });
  drawn.add(type);
  return type;
};

export const isComponentWidget = (widget: Widget) => drawn.has(widget.type);

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
    isComponentWidget(widget) ? Attributes.merge(attrs, [reserved, attributed]) : attrs,
    [widget]
  );

// The React widget a marked element holds, its attributes being the widget's.
export const attributedWidget = (elt: Elt<unknown>) => {
  const [widget] = elt.children;
  return Attributes.get(elt.attrs, reserved) == attributed && widget instanceof Widget
    ? widget
    : null;
};

// The root elements React widgets forwarded their ref to, for the doc tile to
// check it got the widget's DOM.
export const widgetRoots = new WeakSet<Element>();

export const widgetRoot = (dom: Element | null) => {
  if (dom) widgetRoots.add(dom);
};
