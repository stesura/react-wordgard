type DOMRef = (dom: Element | null) => void;

// A React decoration's root ref, also given to the React wrapper around it.
export const mergeRefs =
  (ref: DOMRef, outer?: DOMRef): DOMRef =>
  (dom) => {
    ref(dom);
    outer?.(dom);
  };
