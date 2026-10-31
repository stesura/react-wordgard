// Named after react-prosemirror's MarkView, rewritten for Wordgard: draws a
// wrapper, either an element-shaped mark or the span holding a text run's
// attribute-shaped marks.
import { type ReactNode, createElement } from "react";
import type { Elt } from "wordgard/doc";

import { attrsToRecord, htmlAttrsToReactProps } from "../../helpers/index.js";

type Props = {
  elt: Elt;
  children: ReactNode;
};

export const MarkView = ({ elt, children }: Props) =>
  createElement(elt.tagName, htmlAttrsToReactProps(attrsToRecord(elt.attrs)), children);
