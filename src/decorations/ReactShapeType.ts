// Named after ReactWidgetType: a React shape is a real Wordgard `Elt` with a
// content hole, the shape plain Wordgard draws, registered as drawn by a
// component, which renders the content as `children`. Wordgard copies an Elt
// when it adds attributes or wraps it, so the registration is a reserved
// attribute, which every copy keeps; React never renders it. The props follow
// react-prosemirror's node views (`nodeProps`, `contentDOMRef`, a forwarded
// ref), named after the decoration: Wordgard has no node views.
import {
  type AllHTMLAttributes,
  type ComponentType,
  type HTMLProps,
  type ReactElement,
  type ReactNode,
  type RefAttributes,
  type RefCallback,
  createElement,
} from "react";
import { Attributes, type Node as DocNode, Elt } from "wordgard/doc";

export type ShapeViewComponentProps<E extends Element = HTMLElement> =
  AllHTMLAttributes<HTMLElement> & {
    nodeProps: {
      node: DocNode;
      getPos: () => number;
      contentDOMRef: RefCallback<Element>;
    };
    children: ReactNode;
  } & RefAttributes<E>;

export type ReactShapeSpec<E extends Element = HTMLElement> = {
  component: ComponentType<ShapeViewComponentProps<E>>;
  // The component's root element: `target` selectors match it, and plain
  // Wordgard draws it. `span` for an inline node.
  element?: string;
};

const reserved = "data-wg-react";

type DrawProps = {
  attrs: HTMLProps<HTMLElement>;
  nodeProps: ShapeViewComponentProps["nodeProps"];
  children: ReactNode;
  ref: RefCallback<Element>;
};

const draws = new Map<string, (props: DrawProps) => ReactElement>();

export const reactShape = <E extends Element = HTMLElement>({
  component,
  element = "div",
}: ReactShapeSpec<E>): Elt => {
  const id = String(draws.size + 1);
  draws.set(id, ({ attrs, nodeProps, children, ref }) =>
    createElement(component, { ...attrs, ref, nodeProps, children })
  );
  return Elt.mk(element, { [reserved]: id }, [0]);
};

const idOf = (elt: Elt<unknown>) => Attributes.get(elt.attrs, reserved);

export const isReactShape = (elt: Elt<unknown>) => {
  const id = idOf(elt);
  return id != null && draws.has(id);
};

// The attributes Wordgard merged onto the shape, without the reserved one.
export const shapeAttributes = (elt: Elt<unknown>) => {
  const attrs: string[] = [];
  for (let i = 0; i + 1 < elt.attrs.length; i += 2) {
    const name = elt.attrs[i];
    const value = elt.attrs[i + 1];
    if (name !== undefined && value !== undefined && name != reserved) attrs.push(name, value);
  }
  return attrs;
};

export const drawShape = (elt: Elt<unknown>, props: DrawProps) => {
  const draw = draws.get(idOf(elt) ?? "");
  if (!draw) throw new Error("Not a React shape");
  return draw(props);
};

// A drawn React shape: its root element and the element its content is in
// (the root without a `contentDOMRef`).
export type ShapeHandle = {
  root: Element | null;
  content: Element | null;
};

const roots = new WeakMap<Element, ShapeHandle>();
const contents = new WeakMap<Element, ShapeHandle>();

export const shapeOfRoot = (dom: Element) => roots.get(dom);

export const contentOf = (handle: ShapeHandle) => handle.content ?? handle.root;

export const createShapeHandle = () => {
  const handle: ShapeHandle = { root: null, content: null };
  const ref = (dom: Element | null) => {
    if (handle.root) roots.delete(handle.root);
    handle.root = dom;
    if (dom) roots.set(dom, handle);
  };
  const contentDOMRef = (dom: Element | null) => {
    if (handle.content) contents.delete(handle.content);
    handle.content = dom;
    if (dom) contents.set(dom, handle);
  };
  return { handle, ref, contentDOMRef };
};

// The React shape whose chrome or structure `node` is in: the first shape
// root found going up, unless a shape's content element comes first.
const shapeAround = (node: Node | null): ShapeHandle | null => {
  for (let cur = node; cur; cur = cur.parentNode) {
    if (!(cur instanceof Element)) continue;
    if (contents.has(cur)) return null;
    const root = roots.get(cur);
    // A root without a content element holds the content itself.
    if (root) return root.content ? root : null;
  }
  return null;
};

// Sorts DOM mutation records: the ones a React shape's own commit made outside
// its content go (Wordgard would take them for edits), and the shapes whose
// structure changed (an element added or removed between the root and the
// content) are collected, for their tiles to be rebuilt.
export const sortRecords = (records: readonly MutationRecord[], changed: Set<Element>) =>
  records.filter((record) => {
    const { target } = record;
    if (record.type == "attributes") {
      if (!(target instanceof Element)) return true;
      return !contents.has(target) && !roots.has(target) && !shapeAround(target);
    }
    if (record.type == "childList" && target instanceof Element && contents.has(target))
      return true;
    const handle = shapeAround(target);
    if (!handle) return true;
    const content = contentOf(handle);
    if (
      record.type == "childList" &&
      handle.root &&
      content &&
      target instanceof Element &&
      target.contains(content)
    )
      changed.add(handle.root);
    return false;
  });
