// The elements React drew for node views and mark wrappers: what a container's
// content is made of, so a React shape's chrome beside its content (in the
// same element) can be told apart from it.
export const viewRoots = new WeakSet<Element>();

export const viewRoot = (dom: Element | null) => {
  if (dom) viewRoots.add(dom);
};
