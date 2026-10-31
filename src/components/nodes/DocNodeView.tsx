// Named after react-prosemirror's DocNodeView, rewritten for Wordgard: the
// document's content renders straight into Wordgard's content element, which
// is React's container.

import React from "react";

import type { ChildView } from "../../decorations/iterDeco.js";
import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  views: readonly ChildView[];
};

export const DocNodeView = ({ views }: Props) => <ChildNodeViews views={views} />;
