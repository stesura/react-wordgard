// Named after react-prosemirror's WidgetView, rewritten for Wordgard: draws a
// React widget's component, whose root element becomes the widget's DOM.
// ReactDocTile builds its tile after the commit, so there's no view
// description to register here. Skipped while the widget is `eq`, so the
// component keeps its DOM, as Wordgard keeps an equal widget's.
import React, { memo, useMemo, useState } from "react";
import type { Widget } from "wordgard/editor";

import { WidgetContext, createWidgetHandle } from "../contexts/WidgetContext.js";
import { drawWidget } from "../decorations/ReactWidgetType.js";
import { mergeRefs } from "../helpers/refs.js";

type Props = {
  widget: Widget;
  // Also given the root: a React wrapper's, when this widget draws the node
  // it wraps.
  outerRef?: (dom: Element | null) => void;
};

export const WidgetView = memo(
  ({ widget, outerRef }: Props) => {
    const [handle] = useState(createWidgetHandle);
    const ref = useMemo(() => mergeRefs(handle.ref, outerRef), [handle, outerRef]);
    return (
      <WidgetContext.Provider value={handle}>{drawWidget(widget, ref)}</WidgetContext.Provider>
    );
  },
  (a, b) => a.widget.eq(b.widget) && a.outerRef == b.outerRef
);
