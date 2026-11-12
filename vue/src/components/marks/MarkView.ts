// Adapted from react-wordgard's MarkView for Vue: an element-shaped mark, the span of a text run's
// attribute-shaped marks, or a Vue mark, with its content as its own children.
import { h } from "vue";

import type { ChildView } from "../../../../src/decorations/iterDeco.js";
import { localTagName } from "../../../../src/helpers/elt.js";
import { viewRoot } from "../../../../src/viewRoots.js";
import { eltProps } from "../../helpers/props.js";
import { withRef } from "../../helpers/refs.js";
import { renderChildViews } from "../ChildNodeViews.js";
import { VueMarkView } from "./VueMarkView.js";

type WrapperView = Extract<ChildView, { type: "wrapper" }>;

export const MarkView = (key: string, { elt, mark, children }: WrapperView) =>
  mark
    ? h(VueMarkView, { key, elt, mark, views: children })
    : withRef(
        h(localTagName(elt.tagName), { key, ...eltProps(elt.attrs) }, renderChildViews(children)),
        viewRoot
      );
