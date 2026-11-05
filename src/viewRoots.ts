// The elements React drew for node views and mark wrappers, to tell a React shape's chrome from its
// content.
export const viewRoots = new WeakSet<Element>();

export const viewRoot = (dom: Element | null) => {
  if (dom) viewRoots.add(dom);
};
