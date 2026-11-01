// Named after react-prosemirror's WidgetView, rewritten for Wordgard: draws a
// React widget's component, whose root element becomes the widget's DOM.
// ReactDocTile builds its tile after the commit, so there's no view
// description to register here. Skipped while the widget is `eq`, so the
// component keeps its DOM, as Wordgard keeps an equal widget's.
import React, { memo, useMemo, useRef, useState } from "react";
import type { Widget } from "wordgard/editor";

import {
  DecorationContext,
  createDecorationHandlers,
  decorationRoot,
} from "../contexts/DecorationContext.js";
import { drawWidget, widgetRoot } from "../decorations/ReactWidgetType.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../helpers/index.js";
import { mergeRefs } from "../helpers/refs.js";

type Props = {
  widget: Widget;
  // The attributes of the node it draws.
  attrs?: readonly string[];
  // Whether it draws a selected node, or is in one's shape.
  selected?: boolean;
  // Also given the root: a React wrapper's, when this widget draws the node
  // it wraps.
  outerRef?: ((dom: Element | null) => void) | undefined;
};

export const WidgetView = memo(
  ({ widget, attrs = none, selected = false, outerRef }: Props) => {
    const root = useRef<Element | null>(null);
    const [handlers] = useState(() =>
      createDecorationHandlers(() => {
        // A removed element keeps its last tile.
        const tile = root.current?.isConnected && root.current.wgTile;
        if (!tile) throw new Error("This React widget isn't drawn");
        return tile.posBefore;
      })
    );
    const ref = useMemo(
      () =>
        mergeRefs(
          (dom) => {
            root.current = dom;
          },
          widgetRoot,
          decorationRoot(handlers),
          outerRef
        ),
      [root, handlers, outerRef]
    );
    const decoration = useMemo(() => ({ handlers, selected }), [handlers, selected]);
    return (
      <DecorationContext.Provider value={decoration}>
        {drawWidget(widget, ref, htmlAttrsToReactProps(attrsToRecord(attrs)))}
      </DecorationContext.Provider>
    );
  },
  (a, b) =>
    a.widget.eq(b.widget) &&
    a.outerRef == b.outerRef &&
    a.selected == b.selected &&
    sameAttrs(a.attrs ?? none, b.attrs ?? none)
);

const none: readonly string[] = [];

const sameAttrs = (a: readonly string[], b: readonly string[]) =>
  a.length == b.length && a.every((value, i) => value == b[i]);
