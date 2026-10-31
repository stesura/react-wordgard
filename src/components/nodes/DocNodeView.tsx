// Named after react-prosemirror's DocNodeView, rewritten for Wordgard: the
// document's content renders straight into Wordgard's content element, which
// is React's container.

import React from "react";
import type { Plot } from "wordgard/doc";

import type { CompositionView } from "../../composition.js";
import { ChildNodeViews } from "../ChildNodeViews.js";

type Props = {
  doc: Plot;
  composition?: CompositionView;
};

export const DocNodeView = ({ doc, composition }: Props) => (
  <ChildNodeViews node={doc} composition={composition} />
);
