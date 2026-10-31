// Named after react-prosemirror's DocNodeView, rewritten for Wordgard: the
// document's content renders straight into Wordgard's content element, which
// is React's container.

import React from "react";
import type { Plot } from "wordgard/doc";

import type { ChildView } from "../../decorations/iterDeco.js";
import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  doc: Plot;
  views: readonly ChildView[];
};

export const DocNodeView = ({ doc, views }: Props) => <ChildNodeViews node={doc} views={views} />;
