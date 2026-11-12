// Named after react-prosemirror's DocNodeView, rewritten for Wordgard: renders straight into
// Wordgard's content element, React's container.

import React from "react";

import type { ChildView } from "@stesura/wordgard-view";
import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  views: readonly ChildView[];
};

export const DocNodeView = ({ views }: Props) => <ChildNodeViews views={views} />;
