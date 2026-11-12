// Not in react-wordgard, where refs are callbacks React calls in its commit. Vue sets template refs
// after its patch, in a post-flush job, which runs after a flush forced from another component's
// `onMounted` or a post watcher: too late for the tiles. A directive's `created`, `beforeUpdate`
// and `beforeUnmount` hooks run in the patch itself. On a component, Vue gives it to the
// component's root element.
import type { ComponentInternalInstance, DirectiveBinding, ObjectDirective, VNode } from "vue";

export type DOMRef = (dom: Element | null) => void;

// The element each ref was last given. React detaches every ref before it
// attaches the new ones; Vue's hooks come in patch order (a parent's
// `beforeUpdate` before its children's `beforeUnmount`), so a ref is only
// detached from the element it holds.
const holds = new WeakMap<DOMRef, Element>();

const attach = (ref: DOMRef, dom: Element) => {
  holds.set(ref, dom);
  ref(dom);
};

const detach = (ref: DOMRef, dom: Element) => {
  if (holds.get(ref) != dom) return;
  holds.delete(ref);
  ref(null);
};

const refDirective: ObjectDirective<Element, DOMRef> = {
  created: (dom, { value }) => attach(value, dom),
  beforeUpdate: (dom, { value, oldValue }) => {
    if (value == oldValue) return;
    if (oldValue) detach(oldValue, dom);
    attach(value, dom);
  },
  beforeUnmount: (dom, { value }) => detach(value, dom),
};

// Set by hand rather than with `withDirectives`, which needs a component
// rendering: the document's own elements have none.
export const withRef = <T extends VNode>(vnode: T, ref: DOMRef): T => {
  const binding: DirectiveBinding<DOMRef> = {
    dir: refDirective,
    instance: null,
    value: ref,
    oldValue: null,
    arg: undefined,
    modifiers: {},
  };
  vnode.dirs = vnode.dirs ? [...vnode.dirs, binding] : [binding];
  return vnode;
};

// For the vnode of a decoration's component, whose root is the decoration's:
// only when it mounts, or draws another component or root element (a cell
// becoming a header, `td` to `th`). Vue renders a component again whenever its
// parent does while its vnode has a directive; without one, it doesn't when
// its props hold. Between those, the root is the component's for good.
export const rootRef = (instance: ComponentInternalInstance, ref: DOMRef) => {
  let drawn: { component: unknown; tag: string } | null = null;
  return <T extends VNode>(vnode: T, tag: string): T => {
    if (instance.isMounted && drawn?.component == vnode.type && drawn.tag == tag) return vnode;
    drawn = { component: vnode.type, tag };
    return withRef(vnode, ref);
  };
};

// Gives the ref `target` returns the element this one gets, and detaches only
// what it gave: a wrapper's ref goes to its shape's root, and Vue may mount a
// new shape before it unmounts the old one.
export const forwardTo = (target: () => DOMRef | undefined): DOMRef => {
  let given: { ref: DOMRef; dom: Element } | null = null;
  return (dom) => {
    if (given) detach(given.ref, given.dom);
    given = null;
    const ref = target();
    if (!dom || !ref) return;
    attach(ref, dom);
    given = { ref, dom };
  };
};

export const mergeRefs =
  (...refs: (DOMRef | undefined)[]): DOMRef =>
  (dom) => {
    for (const ref of refs) ref?.(dom);
  };

export const noRef: DOMRef = () => {};
