// Adapted from react-wordgard's WrapperView for Vue: draws a Vue wrapper's component, what it wraps
// going to its WrappedNode. No effects: VueDocTile builds the tiles over what it commits.
import {
  type VNode,
  computed,
  defineComponent,
  getCurrentInstance,
  h,
  provide,
  shallowRef,
} from "vue";
import type { Node } from "wordgard/doc";

import {
  createDecorationHandlers,
  decorationRoot,
} from "../../../src/decorations/decorationHandlers.js";
import {
  createWrapperHandle,
  nodePos,
  shapeAttributes,
} from "../../../src/decorations/shapeType.js";
import type { DecoElt } from "../../../src/wordgardInternals.js";
import { ContentKey, WrappedKey } from "../contexts/ContentContext.js";
import { DecorationKey, DecorationRootKey } from "../contexts/DecorationContext.js";
import { wrapperComponent } from "../decorations/VueWrapperType.js";
import { decorationProps } from "../helpers/props.js";
import { type DOMRef, forwardTo, mergeRefs, rootRef } from "../helpers/refs.js";
import { vueWords } from "../words.js";

type Props = {
  elt: DecoElt;
  node: Node;
  // Draws what's wrapped, its root's ref given.
  wrapped: (ref: DOMRef) => VNode;
  selected: boolean;
  outerRef?: DOMRef;
};

export const WrapperView = defineComponent(
  (props: Props) => {
    const instance = getCurrentInstance();
    if (!instance) throw new Error("No component instance");
    const { handle, ref, wrappedRef } = createWrapperHandle();
    const handlers = createDecorationHandlers(nodePos(handle, vueWords.name));
    const draw = shallowRef(() => props.wrapped(wrappedRef));
    provide(DecorationKey, { handlers, selected: computed(() => props.selected) });
    provide(DecorationRootKey, { tagName: () => props.elt.tagName });
    provide(WrappedKey, { draw });
    provide(ContentKey, null);
    const root = mergeRefs(
      ref,
      decorationRoot(handlers),
      forwardTo(() => props.outerRef)
    );
    const nodeProps = computed(() => ({ node: props.node, getPos: handlers.getPos }));
    const attach = rootRef(instance, root);
    return () => {
      const { elt, wrapped } = props;
      draw.value = () => wrapped(wrappedRef);
      const attrs = decorationProps(shapeAttributes(elt));
      const vnode = h(wrapperComponent(elt), { ...attrs, nodeProps: nodeProps.value });
      return attach(vnode, elt.tagName);
    };
  },
  { props: ["elt", "node", "wrapped", "selected", "outerRef"] }
);
