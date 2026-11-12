// Adapted from react-prosemirror's useMergedDOMRefs (src/refs.ts there), without its typecast.
import { type Ref, type RefCallback, useCallback } from "react";

/**
 * One ref setting several, as for a root that's also the content element (`ref` and
 * `contentDOMRef`).
 */
export const useMergedDOMRefs = <Value>(...refs: (Ref<Value> | undefined)[]): RefCallback<Value> =>
  useCallback(
    (value: Value) => {
      for (const ref of refs) {
        if (typeof ref == "function") ref(value);
        else if (ref) Object.assign(ref, { current: value });
      }
    },
    // The refs themselves, as react-prosemirror's: a new callback when one
    // changes, so React gives it the element.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
    refs
  );
