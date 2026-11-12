// Adapted from react-wordgard's WidgetView for Vue. While the widget is `eq` the one drawn, the
// component gets the same value, so it keeps its DOM, as Wordgard keeps an equal widget's.
import { computed, defineComponent, getCurrentInstance, provide } from "vue";
import type { Widget } from "wordgard/editor";

import {
  createDecorationHandlers,
  decorationRoot,
} from "../../../src/decorations/decorationHandlers.js";
import { VOID } from "../../../src/decorations/iterDeco.js";
import { widgetRoot } from "../../../src/decorations/widgetType.js";
import { ContentKey, WrappedKey } from "../contexts/ContentContext.js";
import { DecorationKey, DecorationRootKey } from "../contexts/DecorationContext.js";
import { drawWidget, widgetElement } from "../decorations/VueWidgetType.js";
import { decorationProps } from "../helpers/props.js";
import { type DOMRef, forwardTo, mergeRefs, rootRef } from "../helpers/refs.js";

type Props = {
  widget: Widget;
  // The attributes of the node it draws.
  attrs?: readonly string[];
  // Whether it draws a selected node, or is in one's shape.
  selected?: boolean;
  // Also given the root: a Vue wrapper's, when this widget draws the node it
  // wraps.
  outerRef?: DOMRef;
};

export const WidgetView = defineComponent(
  (props: Props) => {
    const instance = getCurrentInstance();
    if (!instance) throw new Error("No component instance");
    let root: Element | null = null;
    const handlers = createDecorationHandlers(() => {
      // A removed element keeps its last tile.
      const tile = root?.isConnected && root.wgTile;
      if (!tile) throw new Error("This Vue widget isn't drawn");
      return tile.posBefore;
    });
    let drawn = props.widget;
    provide(DecorationKey, { handlers, selected: computed(() => !!props.selected) });
    provide(DecorationRootKey, { tagName: () => widgetElement(drawn) });
    provide(ContentKey, null);
    provide(WrappedKey, null);
    const ref = mergeRefs(
      (dom) => {
        root = dom;
      },
      widgetRoot,
      decorationRoot(handlers),
      forwardTo(() => props.outerRef)
    );
    const attach = rootRef(instance, ref);
    return () => {
      if (!drawn.eq(props.widget)) drawn = props.widget;
      const attrs = decorationProps(props.attrs ?? []);
      // As react-wordgard's: a non-editable void root is drawn uneditable,
      // which Wordgard 0.7.0's setUneditable would otherwise set after
      // insertion.
      if (!drawn.type.editable && VOID.test(widgetElement(drawn)) && !("contenteditable" in attrs))
        attrs["contenteditable"] = "false";
      const vnode = drawWidget(drawn, attrs);
      if (!vnode) throw new Error("Not a Vue widget");
      return attach(vnode, widgetElement(drawn));
    };
  },
  { props: ["widget", "attrs", "selected", "outerRef"] }
);
