// Named after react-prosemirror's MarkView, rewritten for Wordgard: draws a
// wrapper, either an element-shaped mark or the span holding a text run's
// attribute-shaped marks. It draws what it holds from its views, so it can be
// skipped while they're the same (iterDeco keeps a wrapper's unchanged views).
import { createElement, memo } from "react";

import type { ChildView } from "../../decorations/iterDeco.js";
import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";
import { renderChildViews } from "../ChildNodeViews.js";
import { viewRoot } from "../../viewRoots.js";

type Props = {
  elt: DecoElt;
  views: readonly ChildView[];
};

export const MarkView = memo(
  ({ elt, views }: Props) =>
    createElement(
      elt.tagName,
      { ...htmlAttrsToReactProps(attrsToRecord(elt.attrs)), ref: viewRoot },
      renderChildViews(views)
    ),
  (a, b) => a.views == b.views && a.elt.eq(b.elt)
);
