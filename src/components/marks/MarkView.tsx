// Named after react-prosemirror's MarkView, rewritten for Wordgard: draws a
// wrapper, either an element-shaped mark or the span holding a text run's
// attribute-shaped marks.
import { type ReactNode, createElement } from "react";

import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";
import type { DecoElt } from "../../wordgardInternals.js";

type Props = {
  elt: DecoElt;
  children: ReactNode;
};

export const MarkView = ({ elt, children }: Props) =>
  createElement(elt.tagName, htmlAttrsToReactProps(attrsToRecord(elt.attrs)), children);
