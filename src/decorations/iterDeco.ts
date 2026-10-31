// Named after react-prosemirror's iterDeco, rewritten for Wordgard: lays out a
// plot's content from Wordgard's DecoIterator (copied in ./DecoIterator.ts),
// the way its ContentUpdate.build does (src/editor/tile.ts in its repo), for
// React to render and ReactDocTile to build tiles over. Each plot is laid out
// on its own; a plot that kept its identity outside the ranges an update
// redraws keeps its previous layout.
import { Attributes, Elt, Leaf, type Mark, type Node, type Plot } from "wordgard/doc";
import { type Decoration, Widget } from "wordgard/editor";

import type { CompositionView } from "../composition.js";
import type { DecoElt } from "../wordgardInternals.js";
import {
  type DecoIterator,
  type DecoWalker,
  type WrapperSource,
  renderMarkWrapper,
  renderWrapper,
  spanningOf,
} from "./DecoIterator.js";

export type NodeView = {
  type: "node";
  node: Node;
  // The node's index in its parent plot's content, for its key.
  index: number;
  shape: Decoration.Shape;
  // The plot's content, laid out on its own, or null when its shape has no hole.
  children: readonly ChildView[] | null;
};

// `key` is set on wrappers that must keep the element React committed: those
// around a composition.
type WrapperChildView = {
  type: "wrapper";
  elt: DecoElt;
  spanning: boolean;
  children: ChildView[];
  key?: string;
};

export type ChildView =
  | NodeView
  | { type: "text"; text: string }
  | WrapperChildView
  // The `<img class="wg-buffer">` at the start (-1) or end (1) of an inline plot.
  | { type: "buffer"; side: -1 | 1 }
  // The browser's text node during a composition (ContentUpdate.composition):
  // React keeps `rendered` there, what it last committed, or draws nothing.
  | { type: "composition"; key: string; rendered: string | null }
  | { type: "trailingHack" };

// A wrapper to open: a mark's, or one the DOM already has (with the key React
// gave it).
export type WrapperView = {
  readonly elt: DecoElt;
  readonly spanning: boolean;
  readonly key?: string;
};

// Where a composition sits in a plot's content, as offsets in it, and the
// wrappers around it. Like Wordgard, those are the ones the browser's node sits
// in, not its marks', or, for `cursor` (typing with marks and no text yet), the
// marks' around a buffer.
export type CompositionLayout = {
  readonly from: number;
  readonly to: number;
  readonly wrappers: readonly WrapperView[];
  readonly cursor: boolean;
};

// The wrappers of the marks the cursor types with (ContentUpdate.composition
// opens only those with an element).
export const cursorWrappers = (marks: Mark.Set): WrapperView[] =>
  marks
    .filter((mark) => mark.type.element)
    .map((mark) => ({ elt: renderMarkWrapper(mark), spanning: mark.type.spanning }));

// buildNodeShape's rule: in editable content, the outermost element without a
// content hole becomes uneditable, unless it's a void element, and so does
// what it holds.
export const uneditable = (shape: DecoElt, inEditable: boolean) => {
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

// Whether React can skip a node view: it would draw the same thing.
export const sameNodeView = (a: NodeView, b: NodeView) =>
  a == b || (a.node == b.node && a.children == b.children && a.shape.eq(b.shape));

// A spanning wrapper continues the previous sibling when it draws the same
// element, taking in the buffers between them (ContentUpdate.enterSpanning,
// minus a Wordgard bug: docs/wordgard-upstream-bugs.md).
const openWrapper = (views: ChildView[], elt: DecoElt, spanning: boolean) => {
  let i = views.length - 1;
  while (views[i]?.type == "buffer") i--;
  const prev = views[i];
  if (spanning && prev?.type == "wrapper" && prev.spanning && prev.elt.eq(elt)) {
    prev.children.push(...views.splice(i + 1));
    return prev;
  }
  const wrapper: WrapperChildView = { type: "wrapper", elt, spanning, children: [] };
  views.push(wrapper);
  return wrapper;
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
      const { shape, children } = view;
      if (!(shape instanceof Elt) || !children)
        return shape instanceof Elt && shape.tagName.toLowerCase() == "br";
      // Structure around a plot's content is skipped, so the plot decides only
      // when the hole is a direct child (its content, an inline plot's, ends in
      // a buffer); otherwise the scan goes on before it.
      if (shape.children.includes(0)) {
        const found = needsTrailingHack(children);
        if (found !== undefined) return found;
      }
    } else {
      return false;
    }
  }
  return undefined;
};

export type LayoutContext = {
  deco: DecoIterator;
  // The ranges this update redraws, as change sections, or null for all.
  changes: readonly number[] | null;
  // Each plot's content as last laid out, and where it started.
  layouts: WeakMap<Plot, Layout>;
  composition: CompositionView | null;
  // Plots down to the composition, now or in the last layout: laid out again.
  composing: ReadonlySet<Plot>;
};

export type Layout = { readonly start: number; readonly views: readonly ChildView[] };

// Where `pos` in the old document went, or null when it was replaced.
const mapKept = (changes: readonly number[], pos: number) => {
  for (let i = 0, posA = 0, posB = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    if (pos < posA + len) return ins < 0 ? posB + pos - posA : null;
    posA += len;
    posB += ins < 0 ? len : ins;
  }
  return null;
};

// Whether [from, to] in the new document lies in kept sections only.
const isKept = (changes: readonly number[] | null, from: number, to: number) => {
  if (!changes) return false;
  for (let i = 0, posB = 0; i < changes.length && posB <= to; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    const end = posB + (ins < 0 ? len : ins);
    if (ins != -1 && (end == posB ? posB >= from && posB <= to : posB < to && end > from))
      return false;
    posB = end;
  }
  return true;
};

const sources = (wrappers: readonly WrapperSource[]): WrapperView[] =>
  wrappers.map((src) => ({ elt: renderWrapper(src), spanning: spanningOf(src) }));

// A plot's content, from position `start`, for plots whose shape has a hole.
export const iterDeco = (
  context: LayoutContext,
  plot: Plot,
  start: number
): readonly ChildView[] => {
  const end = start + plot.contentLength;
  // Kept only from the same place: a plot object can appear more than once.
  const previous = context.layouts.get(plot);
  if (
    previous &&
    context.changes &&
    mapKept(context.changes, previous.start) == start &&
    !context.composing.has(plot) &&
    isKept(context.changes, start, end)
  )
    return previous.views;
  const views: ChildView[] = [];
  const plots: { view: NodeView; plot: Plot; pos: number }[] = [];
  const indexAt = new Map<number, number>();
  let offset = start;
  for (const [index, child] of plot.content.entries()) {
    indexAt.set(offset, index);
    offset += child.length;
  }
  const wrapped = (wrappers: readonly WrapperView[]) => {
    let target = views;
    for (const { elt, spanning, key } of wrappers) {
      const wrapper = openWrapper(target, elt, spanning);
      if (key) wrapper.key = key;
      target = wrapper.children;
    }
    return target;
  };
  const nodeView = (node: Node, shape: Decoration.Shape, pos: number): NodeView => {
    const index = indexAt.get(pos);
    if (index === undefined) throw new Error(`No index for ${node.name}`);
    return { type: "node", node, index, shape, children: null };
  };
  const walker: DecoWalker = {
    enter: (node, shape, wrappers, pos) => {
      const view = nodeView(node, shape, pos);
      wrapped(sources(wrappers)).push(view);
      plots.push({ view, plot: node, pos });
      return false;
    },
    leave: () => {},
    node: (node, shape, wrappers, partial, pos) => {
      if (partial !== undefined)
        throw new Error(`react-wordgard can't render part of ${node.name}`);
      // Wordgard 0.6.2 can leave empty text leaves; React draws nothing for them
      // (docs/wordgard-upstream-bugs.md).
      if (node.is(Leaf.Text) && !node.param) return;
      let target = wrapped(sources(wrappers));
      if (!node.is(Leaf.Text)) {
        target.push(nodeView(node, shape, pos));
        return;
      }
      // A text node's attributes and wrappers become spanning wrappers.
      while (shape instanceof Elt) {
        target = openWrapper(target, Elt.create(shape.tagName, shape.attrs, [0]), true).children;
        const [inner] = shape.children;
        if (inner === undefined || inner === 0 || typeof inner == "string")
          throw new Error("Unexpected text shape");
        shape = inner;
      }
      addText(target, node.param);
    },
    nodePart: (node) => {
      throw new Error(`react-wordgard can't render part of ${node.name}`);
    },
    widget: (widget, side) => {
      if (widget != Widget.img) throw new Error("react-wordgard can't render widgets yet");
      views.push({ type: "buffer", side: side < 0 ? -1 : 1 });
    },
  };
  const { composition } = context;
  if (composition?.plot == plot) {
    const from = start + composition.layout.from;
    context.deco.walk(start, true, from, walker);
    const target = wrapped(composition.layout.wrappers);
    if (composition.layout.cursor) target.push({ type: "buffer", side: -1 });
    else
      target.push({
        type: "composition",
        key: composition.rendered?.key ?? "composition",
        rendered: composition.rendered?.text ?? null,
      });
    context.deco.walk(start + composition.layout.to, false, end, walker);
  } else {
    context.deco.walk(start, true, end, walker);
  }
  for (const { view, plot, pos } of plots) view.children = iterDeco(context, plot, pos + 1);
  if ((plot.isTextblock || plot.isInline) && needsTrailingHack(views) !== false)
    views.push({ type: "trailingHack" });
  context.layouts.set(plot, { start, views });
  return views;
};
