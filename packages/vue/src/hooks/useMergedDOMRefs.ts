// Adapted from react-wordgard's useMergedDOMRefs for Vue: a function ref, as Vue takes one in a
// template's `:ref`. It gives a component's root element, so a ref on `DecorationRoot` reaches the
// decoration's root. Setup runs once: nothing to memoise.
import type { ComponentPublicInstance, Ref } from "vue";

/**
 * One template ref setting several, each given the element: for a root that a composable also
 * observes. On a component, the element is its root element (`$el`).
 */
export const useMergedDOMRefs =
  (...refs: (Ref<Element | null> | ((dom: Element | null) => void) | undefined)[]) =>
  (value: Element | ComponentPublicInstance | null) => {
    const dom = value instanceof Element ? value : value?.$el instanceof Element ? value.$el : null;
    for (const ref of refs) {
      if (typeof ref == "function") ref(dom);
      else if (ref) ref.value = dom;
    }
  };
