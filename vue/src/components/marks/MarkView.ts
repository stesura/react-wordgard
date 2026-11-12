// Adapted from react-wordgard's MarkView for Vue: an element-shaped mark, or the span of a text
// run's attribute-shaped marks, with its content as its own children.
import { h } from "vue";

import type { ChildView } from "../../../../src/decorations/iterDeco.js";
import { localTagName } from "../../../../src/helpers/elt.js";
import { eltProps } from "../../helpers/props.js";
import { renderChildViews, unsupported } from "../ChildNodeViews.js";

type WrapperView = Extract<ChildView, { type: "wrapper" }>;

export const MarkView = (key: string, { elt, mark, children }: WrapperView) => {
  if (mark) throw unsupported(`the ${mark.type.name} mark`);
  return h(localTagName(elt.tagName), { key, ...eltProps(elt.attrs) }, renderChildViews(children));
};
