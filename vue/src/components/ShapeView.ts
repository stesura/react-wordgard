// Adapted from react-wordgard's ShapeView for Vue: draws a Vue shape's component, Wordgard's
// attributes falling through to its root. Its content goes to NodeContent, which re-renders alone
// when only the content changed. Its own commits are sorted out of Wordgard's DOM observer
// (`sortRecords`).
import { computed, defineComponent, getCurrentInstance, h, provide, shallowRef } from "vue";
import type { Node } from "wordgard/doc";

import {
  createDecorationHandlers,
  decorationRoot,
} from "../../../src/decorations/decorationHandlers.js";
import type { ChildView } from "../../../src/decorations/iterDeco.js";
import { createShapeHandle, nodePos, shapeAttributes } from "../../../src/decorations/shapeType.js";
import type { DecoElt } from "../../../src/wordgardInternals.js";
import { ContentKey, WrappedKey } from "../contexts/ContentContext.js";
import { DecorationKey, DecorationRootKey } from "../contexts/DecorationContext.js";
import { shapeComponent } from "../decorations/VueShapeType.js";
import { decorationProps } from "../helpers/props.js";
import { type DOMRef, forwardTo, mergeRefs, rootRef } from "../helpers/refs.js";
import { vueWords } from "../words.js";

type Props = {
  elt: DecoElt;
  node: Node;
  // The content's views, null for an atom.
  content: readonly ChildView[] | null;
  selected: boolean;
  // Also given the root: a Vue wrapper's, when this shape is what it wraps.
  outerRef?: DOMRef;
};

export const ShapeView = defineComponent(
  (props: Props) => {
    const instance = getCurrentInstance();
    if (!instance) throw new Error("No component instance");
    const { handle, ref, contentDOMRef } = createShapeHandle();
    const handlers = createDecorationHandlers(nodePos(handle, vueWords.name));
    const views = shallowRef(props.content);
    provide(DecorationKey, { handlers, selected: computed(() => props.selected) });
    provide(DecorationRootKey, { tagName: () => props.elt.tagName });
    provide(ContentKey, { views, ref: contentDOMRef });
    provide(WrappedKey, null);
    const root = mergeRefs(
      ref,
      decorationRoot(handlers),
      forwardTo(() => props.outerRef)
    );
    // The same object while the node is: the component renders again only
    // when its node or attributes changed.
    const nodeProps = computed(() => ({ node: props.node, getPos: handlers.getPos }));
    const attach = rootRef(instance, root);
    return () => {
      const { elt } = props;
      handle.atom = !elt.hasContent;
      views.value = props.content;
      const attrs = decorationProps(shapeAttributes(elt));
      const vnode = h(shapeComponent(elt), { ...attrs, nodeProps: nodeProps.value });
      return attach(vnode, elt.tagName);
    };
  },
  { props: ["elt", "node", "content", "selected", "outerRef"] }
);
