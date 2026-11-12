// Adapted from react-wordgard's DecorationRoot for Vue: the decoration's root element, of the tag
// it says. Wordgard's attributes fall through to it, as to any root; its children are its slot's,
// without the anchors a `v-if` or `v-for` would leave among the elements Wordgard reads. With
// `content`, it is also the content element, holding the content as NodeContent does: a component
// moving its content in and out of an inner element keeps its root this way, where switching
// between DecorationRoot and NodeContent would have Vue mount another root.
import { defineComponent, h, inject } from "vue";

import { localTagName } from "@stesura/wordgard-view";
import { ContentKey } from "../contexts/ContentContext.js";
import { DecorationRootKey } from "../contexts/DecorationContext.js";
import { withoutAnchors } from "../helpers/props.js";
import { noRef, withRef } from "../helpers/refs.js";
import { updateInFlush } from "../sync.js";
import { contentChildren } from "./NodeContent.js";

/**
 * The root element of a Vue shape, wrapper, mark or widget: the tag the decoration says, with
 * Wordgard's attributes (which fall through to it) merged with its own. With `content`, it holds
 * the content of a shape or mark, as a `NodeContent`, with its `before` and `after` slots.
 */
export const DecorationRoot = defineComponent(
  (props: { content?: boolean }, { slots }) => {
    const root = inject(DecorationRootKey, null);
    const content = inject(ContentKey, null);
    if (!root)
      throw new Error(
        "DecorationRoot is the root of a Vue shape, wrapper, mark or widget: use it in their component"
      );
    updateInFlush();
    return () => {
      const tag = localTagName(root.tagName());
      if (props.content && !content)
        throw new Error("DecorationRoot holds the content of a Vue shape or mark only");
      const children =
        props.content && content
          ? contentChildren(content, slots)
          : withoutAnchors(slots.default?.() ?? []);
      // Always one ref, so Vue matches it with the last render's.
      return withRef(h(tag, null, children), props.content && content ? content.ref : noRef);
    };
  },
  { props: { content: Boolean } }
);
