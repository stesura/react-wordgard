type DOMRef = (dom: Element | null) => void;

// A React decoration's root ref, with what else must know its root: the
// React wrapper around it, its hooks' handlers.
export const mergeRefs =
  (...refs: (DOMRef | undefined)[]): DOMRef =>
  (dom) => {
    for (const ref of refs) ref?.(dom);
  };
