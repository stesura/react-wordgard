// Named after react-prosemirror's MarkView, rewritten for Wordgard: an element-shaped mark, the
// span of a text run's attribute-shaped marks, or a React mark. Memoised: iterDeco keeps a
// wrapper's unchanged views.
import React, { createElement, memo } from "react";
import type { Mark } from "wordgard/doc";

import { type ChildView, shapeOf } from "../../decorations/iterDeco.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";
import { renderChildViews } from "../ChildNodeViews.js";
import { viewRoot } from "../../viewRoots.js";
import { ReactMarkView } from "./ReactMarkView.js";

type Props = {
  elt: DecoElt;
  views: readonly ChildView[];
  mark?: Mark | undefined;
};

export const MarkView = memo(
  ({ elt, views, mark }: Props) =>
    mark ? (
      <ReactMarkView elt={elt} mark={mark}>
        {renderChildViews(views)}
      </ReactMarkView>
    ) : (
      createElement(
        elt.tagName,
        { ...htmlAttrsToReactProps(attrsToRecord(elt.attrs)), ref: viewRoot },
        renderChildViews(views)
      )
    ),
  (a, b) => shapeOf(a.views) == shapeOf(b.views) && a.elt.eq(b.elt) && a.mark == b.mark
);
