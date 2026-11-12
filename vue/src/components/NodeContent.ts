// Not in react-wordgard, where the content is `children`, put in the `contentDOMRef` element. A
// slot would put anchors (empty text nodes) in the content element, beside the text, so the
// content element is this component (or a DecorationRoot with `content`), the content its own
// children. The `before` and `after` slots are chrome beside a container's content (blocks, not
// text), without anchors.
import { type Slots, type VNode, defineComponent, h, inject } from "vue";

import { localTagName } from "../../../src/helpers/elt.js";
import { type ContentContextValue, ContentKey } from "../contexts/ContentContext.js";
import { DecorationRootKey } from "../contexts/DecorationContext.js";
import { withoutAnchors } from "../helpers/props.js";
import { withRef } from "../helpers/refs.js";
import { updateInFlush } from "../sync.js";
import { renderChildViews } from "./ChildNodeViews.js";

// The content context, for a component drawing the content element.
export const useContent = (component: string) => {
  const content = inject(ContentKey, null);
  if (!content)
    throw new Error(
      `${component} is the content of a Vue shape or mark: use it in their component`
    );
  updateInFlush();
  return content;
};

// The content element's children.
export const contentChildren = (content: ContentContextValue, slots: Slots): VNode[] => [
  ...withoutAnchors(slots.before?.() ?? []),
  ...renderChildViews(content.views.value ?? []),
  ...withoutAnchors(slots.after?.() ?? []),
];

/**
 * The content element of a Vue shape or mark, `as` (by default the decoration's own element), its
 * children the node's content. As the component's root, it is both root and content element.
 */
export const NodeContent = defineComponent(
  (props: { as?: string }, { slots }) => {
    const content = useContent("NodeContent");
    const root = inject(DecorationRootKey, null);
    return () => {
      const tag = props.as ?? (root ? localTagName(root.tagName()) : "div");
      const vnode = h(tag, null, contentChildren(content, slots));
      return withRef(vnode, content.ref);
    };
  },
  { props: ["as"] }
);
