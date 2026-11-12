// The elements React drew for node views and mark wrappers, to tell a React shape's chrome from its
// content.
export const viewRoots = new WeakSet<Element>();

export const viewRoot = (dom: Element | null) => {
  if (dom) viewRoots.add(dom);
};

// Elements of nodes Wordgard draws, drawn with their node wrappers' props (NodeRootProps): their
// attributes are React's, as a React shape's root's are (sortRecords drops those records).
const drawnRoots = new WeakSet<Element>();

export const drawnRoot = (dom: Element | null) => {
  if (dom) drawnRoots.add(dom);
};

export const isDrawnRoot = (dom: EventTarget) => dom instanceof Element && drawnRoots.has(dom);
