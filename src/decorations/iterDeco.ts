// Named after react-prosemirror's iterDeco, rewritten for Wordgard: lays out a
// plot's content the way Wordgard's DecoIterator.walk and ContentUpdate.build
// do (src/editor/decoration.ts and tile.ts in its repo), for React to render
// and ReactDocTile to build tiles over. No decorations or mark shape overrides
// yet.
import { Attributes, Elt, Leaf, type Mark, type Node, type Plot } from "wordgard/doc";

export type ChildView =
  | { type: "node"; node: Node }
  | { type: "text"; text: string }
  | { type: "wrapper"; elt: Elt; spanning: boolean; children: ChildView[] }
  // The `<img class="wg-buffer">` at the start (-1) or end (1) of an inline plot.
  | { type: "buffer"; side: -1 | 1 }
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

const tagShape = memo((tag: Node.Tag) => {
  const { shape, attrs } = addMarkAttributes(tag, tag.type.shape.create(tag.param));
  if (!shape) throw new Error(`No shape for ${tag.type.name}`);
  return attrs ? shape.addAttrs(attrs) : shape;
});

// The element a node renders as, its marks' attributes included.
export const nodeShape = (node: Node) => tagShape(node.isPlot ? node.tag : node);

// buildNodeShape's rule: in editable content, the outermost element without a
// content hole becomes uneditable, unless it's a void element, and so does
// what it holds.
export const uneditable = (shape: Elt, inEditable: boolean) => {
  if (!inEditable || shape.hasContent) return { shape, inEditable };
  if (
    Attributes.get(shape.attrs, "contenteditable") == null &&
    !/^(br|hr|img|input|wbr)$/i.test(shape.tagName)
  )
    shape = Elt.create(
      shape.tagName,
      Attributes.merge(shape.attrs, ["contenteditable", "false"]),
      shape.children
    );
  return { shape, inEditable: false };
};

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
// element, taking in the buffers between them (ContentUpdate.enterSpanning,
// minus a Wordgard bug: docs/wordgard-upstream-bugs.md).
const openWrapper = (views: ChildView[], elt: Elt, spanning: boolean) => {
  let i = views.length - 1;
  while (views[i]?.type == "buffer") i--;
  const prev = views[i];
  if (spanning && prev?.type == "wrapper" && prev.spanning && prev.elt.eq(elt)) {
    prev.children.push(...views.splice(i + 1));
    return prev.children;
  }
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

// ensureHackNode: a textblock or inline plot needs a trailing <br> when it ends,
// looking inside wrappers, in nothing or in a <br>. Undefined when `views`
// holds nothing to decide on.
const needsTrailingHack = (views: readonly ChildView[]): boolean | undefined => {
  for (let i = views.length - 1; i >= 0; i--) {
    const view = views[i];
    if (!view) continue;
    if (view.type == "wrapper") {
      const found = needsTrailingHack(view.children);
      if (found !== undefined) return found;
    } else if (view.type == "node") {
      const { node } = view;
      const shape = nodeShape(node);
      if (!shape.hasContent) return shape.tagName.toLowerCase() == "br";
      // Structure around a plot's content is skipped, so the plot decides only
      // when the hole is a direct child (its content, an inline plot's, ends in
      // a buffer); otherwise the scan goes on before it.
      if (node.isPlot && shape.children.includes(0)) {
        const found = needsTrailingHack(iterDeco(node));
        if (found !== undefined) return found;
      }
    } else {
      return false;
    }
  }
  return undefined;
};

// A plot's content, for plots whose shape has a content hole.
export const iterDeco = memo((plot: Plot): readonly ChildView[] => {
  const views: ChildView[] = [];
  if (plot.isInline) views.push({ type: "buffer", side: -1 });
  for (const node of plot.content) {
    // Wordgard 0.6.2 can leave empty text leaves; React draws nothing for them
    // (docs/wordgard-upstream-bugs.md).
    if (node.is(Leaf.Text) && !node.param) continue;
    let target = views;
    for (const { elt, spanning } of nodeWrappers(node)) target = openWrapper(target, elt, spanning);
    if (node.is(Leaf.Text)) addText(target, node.param);
    else target.push({ type: "node", node });
    // Wordgard bug: an inline plot drawn as an atom still gets the buffer an
    // inline plot starts with, after it and outside its wrappers
    // (docs/wordgard-upstream-bugs.md).
    if (node.isPlot && node.isInline && !nodeShape(node).hasContent)
      views.push({ type: "buffer", side: -1 });
  }
  if (plot.isInline) views.push({ type: "buffer", side: 1 });
  if ((plot.isTextblock || plot.isInline) && needsTrailingHack(views) !== false)
    views.push({ type: "trailingHack" });
  return views;
});
