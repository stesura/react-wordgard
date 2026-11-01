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

export const reserved = "data-wg-react";

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

export const idOf = (elt: Elt<unknown>) => Attributes.get(elt.attrs, reserved);

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

// A drawn React shape or wrapper: its root element, and the element its
// content is in (a shape's root without a `contentDOMRef`) or, for a wrapper,
// the element it wraps.
export type ShapeHandle = {
  root: Element | null;
  content: Element | null;
  wrapper: boolean;
};

const roots = new WeakMap<Element, ShapeHandle>();
const contents = new WeakMap<Element, ShapeHandle>();
const wrapped = new WeakSet<Element>();
// Every element that was a shape's content element: typing never adds or
// removes one, React moving a shape's content does.
const everContent = new WeakSet<Element>();

export const shapeOfRoot = (dom: Element) => roots.get(dom);

export const contentOf = (handle: ShapeHandle) =>
  handle.content ?? (handle.wrapper ? null : handle.root);

const rootRef = (handle: ShapeHandle) => (dom: Element | null) => {
  if (handle.root) roots.delete(handle.root);
  handle.root = dom;
  if (dom) roots.set(dom, handle);
};

export const createShapeHandle = () => {
  const handle: ShapeHandle = { root: null, content: null, wrapper: false };
  const contentDOMRef = (dom: Element | null) => {
    if (handle.content) contents.delete(handle.content);
    handle.content = dom;
    if (dom) {
      contents.set(dom, handle);
      everContent.add(dom);
    }
  };
  return { handle, ref: rootRef(handle), contentDOMRef };
};

export const createWrapperHandle = () => {
  const handle: ShapeHandle = { root: null, content: null, wrapper: true };
  const wrappedRef = (dom: Element | null) => {
    if (handle.content) wrapped.delete(handle.content);
    handle.content = dom;
    if (dom) wrapped.add(dom);
  };
  return { handle, ref: rootRef(handle), wrappedRef };
};

// The position of the node a React shape or wrapper draws, from its tile: the
// root's, or the one around it when wrapped.
export const nodePos = (handle: ShapeHandle) => () => {
  let tile = handle.root?.isConnected ? handle.root.wgTile : undefined;
  while (tile && !tile.tag) tile = tile.parent ?? undefined;
  if (!tile) throw new Error("This React shape or wrapper isn't drawn");
  return tile.posBefore;
};

// The React shape or wrapper whose chrome or structure `node` is in: the
// first root found going up, unless a shape's content element or a wrapped
// element comes first.
const shapeAround = (node: Node | null): ShapeHandle | null => {
  for (let cur = node; cur; cur = cur.parentNode) {
    if (!(cur instanceof Element)) continue;
    if (contents.has(cur)) return null;
    const root = roots.get(cur);
    // A shape's root without a content element holds the content itself.
    if (root) return root.content ? root : null;
    if (wrapped.has(cur)) return null;
  }
  return null;
};

// The React shape whose content element `dom` is.
const contentShape = (dom: Element) => {
  const handle = contents.get(dom) ?? roots.get(dom);
  return handle && contentOf(handle) == dom ? handle : null;
};

// The React shape or wrapper whose root, or an element inside it, `node` is.
const shapeOf = (node: Node | null) => {
  for (let cur = node; cur; cur = cur.parentNode) {
    const handle = cur instanceof Element ? roots.get(cur) : undefined;
    if (handle) return handle;
  }
  return null;
};

const movesContent = (record: MutationRecord) =>
  [...record.addedNodes, ...record.removedNodes].some(
    (node) => node instanceof Element && everContent.has(node)
  );

// Sorts DOM mutation records: the ones a React shape's own commit made outside
// its content go (Wordgard would take them for edits), and the shapes whose
// structure changed (an element added or removed between the root and the
// content, or beside the content in a container's content element) are
// collected, for their tiles to be rebuilt. The same for a React wrapper, what
// it wraps standing for the content. In a container (blocks, no text),
// the browser's typing never adds or removes children of the content element
// itself, so those records are React's too; `inline` says whether a shape's
// content is text. Typing in an empty textblock in the same task as a commit
// moving its content would be taken for React's (a limit).
export const sortRecords = (
  records: readonly MutationRecord[],
  changed: Set<Element>,
  inline: (root: Element) => boolean
) => {
  // Shapes whose content React moved to another element in these records (one
  // commit's: typing comes in a task of its own): what else changed in their
  // content element is React's too.
  const moved = new Set<ShapeHandle>();
  for (const record of records)
    if (record.type == "childList" && movesContent(record)) {
      const handle = shapeOf(record.target);
      if (handle) moved.add(handle);
    }
  return records.filter((record) => {
    const { target } = record;
    if (record.type == "attributes") {
      if (!(target instanceof Element)) return true;
      return !contents.has(target) && !roots.has(target) && !shapeAround(target);
    }
    const own = record.type == "childList" && target instanceof Element && contentShape(target);
    if (own) {
      if (own.root && inline(own.root) && !moved.has(own)) return true;
      if (own.root) changed.add(own.root);
      return false;
    }
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
};
