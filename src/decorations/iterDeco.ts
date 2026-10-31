// Named after react-prosemirror's iterDeco, rewritten for Wordgard: lays out a
// plot's content the way Wordgard's DecoIterator.walk and ContentUpdate.build
// do (src/editor/decoration.ts and tile.ts in its repo), for React to render
// and ReactDocTile to build tiles over. Marks only: no decorations or mark
// shape overrides yet.
import { Attributes, Elt, Leaf, type Mark, type Node, type Plot } from "wordgard/doc";

export type ChildView =
  | { type: "node"; node: Plot }
  | { type: "text"; text: string }
  | { type: "wrapper"; elt: Elt; spanning: boolean; children: ChildView[] }
  | { type: "trailingHack" };

const memo = <A extends object, T>(f: (arg: A) => T) => {
  const cache = new WeakMap<A, T>();
  return (arg: A) => {
    const cached = cache.get(arg);
    if (cached !== undefined) return cached;
    const result = f(arg);
    cache.set(arg, result);
    return result;
  };
};

// Wordgard's addMarkAttributes. Without an element to put them on (text), the
// attributes come back for a span.
const addMarkAttributes = (tag: Node.Tag, shape: Elt | null) => {
  let attrs: Attributes | null = null;
  for (const mark of tag.marks) {
    const { attribute } = mark.type;
    if (!attribute || (tag.isText && !mark.type.spanning)) continue;
    const markAttrs = attribute.get(mark.value);
    if (!markAttrs.length) continue;
    if (attribute.target && shape) shape = shape.addAttrs(markAttrs, attribute.target);
    else attrs = attrs ? Attributes.merge(attrs, markAttrs) : markAttrs;
  }
  return { shape, attrs };
};

// The element a plot renders as, its marks' attributes included.
export const plotShape = memo((tag: Plot.Tag) => {
  const { shape, attrs } = addMarkAttributes(tag, tag.type.shape.create(tag.param));
  if (!shape) throw new Error(`No shape for ${tag.type.name}`);
  return attrs ? shape.addAttrs(attrs) : shape;
});

const markWrapper = memo((mark: Mark) => {
  const { element } = mark.type;
  if (!element) throw new Error(`${mark.name} has no element shape`);
  return Elt.create(element.name, element.attrs(mark.value), [0]);
});

// Wordgard's nodeWrappers, plus the span holding a text node's attribute marks
// (opened as a spanning wrapper, innermost).
const nodeWrappers = (node: Node) => {
  const wrappers = node.marks
    .filter((mark) => mark.type.element)
    .map((mark) => ({ elt: markWrapper(mark), spanning: mark.type.spanning, rank: mark.type.rank }))
    .sort((a, b) => Number(b.spanning) - Number(a.spanning) || a.rank - b.rank);
  const { attrs } = node.isText ? addMarkAttributes(node, null) : { attrs: null };
  return attrs ? [...wrappers, { elt: Elt.create("span", attrs, [0]), spanning: true }] : wrappers;
};

// A spanning wrapper continues the previous sibling when it draws the same
// element (ContentUpdate.enterSpanning).
const openWrapper = (views: ChildView[], elt: Elt, spanning: boolean) => {
  const last = views.at(-1);
  if (spanning && last?.type == "wrapper" && last.spanning && last.elt.eq(elt))
    return last.children;
  const wrapper: ChildView = { type: "wrapper", elt, spanning, children: [] };
  views.push(wrapper);
  return wrapper.children;
};

// Adjacent text in the same wrapper is one text node (ContentUpdate.addText).
const addText = (views: ChildView[], text: string) => {
  const last = views.at(-1);
  if (last?.type == "text") last.text += text;
  else views.push({ type: "text", text });
};

// ensureHackNode: a textblock needs a trailing <br> unless its last leaf,
// looking inside wrappers, is text.
const lastLeaf = (views: readonly ChildView[]): ChildView | undefined => {
  for (let i = views.length - 1; i >= 0; i--) {
    const view = views[i];
    if (view?.type != "wrapper") return view;
    const found = lastLeaf(view.children);
    if (found) return found;
  }
  return undefined;
};

export const iterDeco = memo((plot: Plot): readonly ChildView[] => {
  const views: ChildView[] = [];
  for (const node of plot.content) {
    // Wordgard 0.6.2 can leave empty text leaves; React draws nothing for them.
    if (node.is(Leaf.Text) && !node.param) continue;
    let target = views;
    for (const { elt, spanning } of nodeWrappers(node)) target = openWrapper(target, elt, spanning);
    if (node.is(Leaf.Text)) addText(target, node.param);
    else if (node.isPlot) target.push({ type: "node", node });
    else throw new Error(`react-wordgard can't render ${node.name} yet`);
  }
  if (plot.isTextblock && lastLeaf(views)?.type != "text") views.push({ type: "trailingHack" });
  return views;
});
