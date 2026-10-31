// Named after react-prosemirror's WidgetView, rewritten for Wordgard: draws a
// React widget's component, whose root element becomes the widget's DOM.
// ReactDocTile builds its tile after the commit, so there's no view
// description to register here. Skipped while the widget is `eq`, so the
// component keeps its DOM, as Wordgard keeps an equal widget's.
import React, { memo, useState } from "react";
import type { Widget } from "wordgard/editor";

import { WidgetContext, createWidgetHandle } from "../contexts/WidgetContext.js";
import { drawWidget } from "../decorations/ReactWidgetType.js";

type Props = {
  widget: Widget;
};

export const WidgetView = memo(
  ({ widget }: Props) => {
    const [handle] = useState(createWidgetHandle);
    return (
      <WidgetContext.Provider value={handle}>
        {drawWidget(widget, handle.ref)}
      </WidgetContext.Provider>
    );
  },
  (a, b) => a.widget.eq(b.widget)
);
