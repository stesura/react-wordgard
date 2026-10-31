// Named after react-prosemirror's DocNodeView, rewritten for Wordgard: the
// document's content renders straight into Wordgard's content element, which
// is React's container.

import React from "react";
import type { Plot } from "wordgard/doc";

import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  doc: Plot;
};

export const DocNodeView = ({ doc }: Props) => <ChildNodeViews node={doc} />;
