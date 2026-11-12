// Not in react-wordgard, where a wrapper draws what it wraps as `children`. Here it's a component
// whose root is the wrapped drawing: no slot's fragment, so no anchors, and the attributes given
// to it fall through to the wrapped element (a node wrapper's for the node's root).
import { defineComponent, inject } from "vue";

import { WrappedKey } from "../contexts/ContentContext.js";
import { updateInFlush } from "../sync.js";

/** What a Vue wrapper or node wrapper wraps. */
export const WrappedNode = defineComponent(() => {
  const wrapped = inject(WrappedKey, null);
  if (!wrapped)
    throw new Error(
      "WrappedNode is what a Vue wrapper or node wrapper wraps: use it in their component"
    );
  updateInFlush();
  return () => wrapped.draw.value();
});
