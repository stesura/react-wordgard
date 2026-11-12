// Adapted from react-wordgard's WidgetView (by way of vue-wordgard's) for Svelte: a Svelte widget's
// component, mounted. While the widget is `eq` the one drawn, the component keeps its value, so it
// keeps its DOM, as Wordgard keeps an equal widget's.
import type { Widget } from "wordgard/editor";

import {
  VOID,
  attrsToRecord,
  createDecorationHandlers,
  decorationRoot,
  widgetRoot,
} from "@stesura/wordgard-view";
import { widgetComponent } from "../decorations/SvelteWidgetType.js";
import type { DrawContext, Part, RootPart } from "./ChildNodeViews.js";
import { mountDecoration } from "./DecorationView.js";

export type WidgetDraw = {
  readonly widget: Widget;
  // The attributes of the node it draws.
  readonly attrs: readonly string[];
  // Whether it draws a selected node, or is in one's shape.
  readonly selected: boolean;
  // Also given the root: a wrapper's, when this widget draws what it wraps.
  readonly rooted?: (root: Element) => void;
};

type State = { widget: Widget; attrs: readonly string[] };

const states = new WeakMap<Part, State>();

const sameAttrs = (a: readonly string[], b: readonly string[]) =>
  a == b || (a.length == b.length && a.every((value, i) => value == b[i]));

const propsOf = ({ widget, attrs }: State, element: string) => {
  const props: Record<string, unknown> = attrsToRecord(attrs);
  // As react-wordgard's: a non-editable void root is drawn uneditable, which
  // Wordgard 0.7.0's setUneditable would otherwise set after insertion.
  if (!widget.type.editable && VOID.test(element) && !("contenteditable" in props))
    props["contenteditable"] = "false";
  props["value"] = widget.value;
  return props;
};

export const WidgetView = (
  before: Part | undefined,
  key: string,
  { widget, attrs, selected, rooted }: WidgetDraw,
  context: DrawContext
): RootPart => {
  const { component, element } = widgetComponent(widget);
  const state = before && states.get(before);
  if (before?.kind == "root" && before.view == "widget" && state && before.component == component) {
    const drawn = state.widget.eq(widget) ? state.widget : widget;
    if (drawn != state.widget || !sameAttrs(attrs, state.attrs)) {
      state.widget = drawn;
      state.attrs = attrs;
      before.update(propsOf(state, element));
    }
    before.set(selected, element);
    return before;
  }
  let root: Element | null = null;
  const handlers = createDecorationHandlers(() => {
    // A removed element keeps its last tile.
    const tile = root?.isConnected && root.wgTile;
    if (!tile) throw new Error(`This ${context.words.name} widget isn't drawn`);
    return tile.posBefore;
  });
  const fresh: State = { widget, attrs };
  const part = mountDecoration(
    {
      key,
      view: "widget",
      what: "widget",
      component,
      props: propsOf(fresh, element),
      handlers,
      selected,
      tagName: element,
      rooted: (dom) => {
        root = dom;
        widgetRoot(dom);
        decorationRoot(handlers)(dom);
        rooted?.(dom);
      },
      destroy: () => {},
    },
    context
  );
  states.set(part, fresh);
  return part;
};
