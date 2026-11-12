// Named after react-prosemirror's iterDeco, rewritten for Wordgard: lays out a plot's content from
// DecoIterator, as Wordgard's ContentUpdate.build does. A plot that kept its identity outside the
// redrawn ranges keeps its previous layout.
import { Attributes, Elt, Leaf, Mark, type Node, type Plot } from "wordgard/doc";
import { type Decoration, Widget } from "wordgard/editor";

import { isKept, pointMapper, samePlace, unchangedEnds } from "../changes.js";
import type { CompositionView } from "../composition.js";
import { type RenderStore, moveCell } from "../renderStore.js";
import { childViewKeys, createNodeKey } from "../reactKeys.js";
import { type DecoElt, TileFlag } from "../wordgardInternals.js";
import type { Words } from "../words.js";
import {
  type DecoIterator,
  type DecoWalker,
  type WrapperSource,
  documentMark,
  renderMarkWrapper,
  renderWrapper,
  spanningOf,
} from "./DecoIterator.js";
import { isReactMark } from "./markType.js";
import { isReactWidget } from "./widgetType.js";
import { isReactWrapper } from "./wrapperType.js";

export type NodeView = {
  type: "node";
  node: Node;
  // Its React key, from ReactKeys.
  key: string;
  shape: Decoration.Shape;
  // The plot's content, laid out on its own, or null when its shape has no hole.
  children: readonly ChildView[] | null;
};

// `key` is set on wrappers that must keep the element React committed: those
// around a composition. `mark` is a React mark's, from the document.
type WrapperChildView = {
  type: "wrapper";
  elt: DecoElt;
  spanning: boolean;
  children: ChildView[];
  key?: string;
  mark?: Mark;
};

// A point widget. React draws a React widget, and nothing for the others:
// ReactDocTile renders or reuses their DOM. A React point widget has a key that
// follows its position, `offset` in the plot's content.
type WidgetChildView = {
  type: "widget";
  widget: Widget;
  side: number;
  key?: string;
  offset?: number;
};

export type ChildView =
  | NodeView
  | { type: "text"; text: string }
  | WrapperChildView
  // The `<img class="wg-buffer">` at the start (-1) or end (1) of an inline plot.
  | { type: "buffer"; side: -1 | 1 }
  | WidgetChildView
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
  readonly mark?: Mark;
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
    .map((mark) => wrapperView(renderMarkWrapper(mark), mark.type.spanning, mark));

// A React mark's component gets its mark, and draws only runs of it.
const wrapperView = (elt: DecoElt, spanning: boolean, mark: Mark | undefined): WrapperView =>
  mark && isReactMark(elt) ? { elt, spanning, mark: documentMark(mark) } : { elt, spanning };

const sameMark = (a: Mark | undefined, b: Mark | undefined) => a == b || (!!a && !!b && a.eq(b));

// The elements Wordgard doesn't give contenteditable="false" to an uneditable
// element shape.
export const VOID = /^(br|hr|img|input|wbr)$/i;

// buildNodeShape's rule: in editable content, the outermost element without a
// content hole becomes uneditable, unless it's a void element, and so does
// what it holds. `flag` is the tile's Uneditable flag.
export const uneditable = (shape: DecoElt, inEditable: boolean) => {
  if (!inEditable || shape.hasContent) return { shape, inEditable, flag: 0 };
  const attr = Attributes.get(shape.attrs, "contenteditable");
  let flag = attr == "false" ? TileFlag.Uneditable : 0;
  if (attr == null && !VOID.test(shape.tagName)) {
    shape = Elt.create(
      shape.tagName,
      Attributes.merge(shape.attrs, ["contenteditable", "false"]),
      shape.children
    );
    flag = TileFlag.Uneditable;
  }
  return { shape, inEditable: false, flag };
};

// Whether React can skip a node view: it would draw the same thing.
export const sameNodeView = (a: NodeView, b: NodeView) =>
  a == b || (a.node == b.node && a.children == b.children && a.shape.eq(b.shape));

// Whether two views draw the same thing.
const sameView = (view: ChildView, other: ChildView): boolean => {
  if (view == other) return true;
  switch (view.type) {
    case "node":
      return other.type == "node" && view.key == other.key && sameNodeView(view, other);
    case "text":
      return other.type == "text" && view.text == other.text;
    case "wrapper":
      return (
        other.type == "wrapper" &&
        view.key == other.key &&
        view.spanning == other.spanning &&
        view.elt.eq(other.elt) &&
        sameMark(view.mark, other.mark) &&
        view.children.length == other.children.length &&
        view.children.every((child, i) => {
          const match = other.children[i];
          return !!match && sameView(child, match);
        })
      );
    case "buffer":
      return other.type == "buffer" && view.side == other.side;
    case "widget":
      return (
        other.type == "widget" &&
        view.side == other.side &&
        view.key == other.key &&
        view.offset == other.offset &&
        view.widget.eq(other.widget)
      );
    case "composition":
      return (
        other.type == "composition" && view.key == other.key && view.rendered == other.rendered
      );
    case "trailingHack":
      return other.type == "trailingHack";
  }
};

// What makes a list draw as before: the same keys, each for the same view or
// for a node that kept its cell (moveCell). A list whose shape is another's
// last one's shares it.
const shapes = new WeakMap<readonly ChildView[], object>();

export const shapeOf = (views: readonly ChildView[]) => shapes.get(views) ?? views;

// A plot's content laid out again, keeping the old view of each child that
// draws the same, matched by its React key (which React keeps the component
// for), and the old list when they all do. A wrapper that changed keeps the
// children that didn't. React then skips what's kept (the views' memos): a
// plot can change while its content doesn't (a paragraph's alignment, a mark
// on its tag), and typing changes one text run of a paragraph. A node that
// keeps its key keeps its cell, so a list whose shape is the same isn't drawn
// again for it. `after` holds `before`'s first `head` and last `tail` views
// (iterDeco's unchanged ends, all nodes): only the middle is matched. Writes
// what it keeps into `after`.
const keepSame = (
  store: RenderStore,
  before: readonly ChildView[],
  after: ChildView[],
  head = 0,
  tail = 0
): readonly ChildView[] => {
  const whole = !head && !tail;
  const old = new Map(
    childViewKeys(whole ? before : before.slice(head, before.length - tail)).map(
      ({ view, key }) => [key, view]
    )
  );
  let changed = before.length != after.length;
  let sameShape = !changed;
  childViewKeys(whole ? after : after.slice(head, after.length - tail)).forEach(
    ({ view, key }, at) => {
      const i = head + at;
      const match = old.get(key);
      let found = view;
      if (match && sameView(match, view)) found = match;
      else if (
        match?.type == "wrapper" &&
        view.type == "wrapper" &&
        match.elt.eq(view.elt) &&
        sameMark(match.mark, view.mark)
      )
        keepSame(store, match.children, view.children);
      if (match?.type == "node" && found.type == "node") {
        moveCell(store, match, found);
        // Vue's list draws nothing for a native widget's node.
        if (isNative(match) != isNative(found)) sameShape = false;
      }
      if (found != before[i]) {
        changed = true;
        if (found.type != "node" || match != before[i]) sameShape = false;
      }
      after[i] = found;
    }
  );
  if (!changed) {
    shapes.set(after, shapeOf(before));
    return before;
  }
  if (sameShape) shapes.set(after, shapeOf(before));
  return after;
};

// A node a native widget draws, which no component draws.
const isNative = ({ shape }: NodeView) => !(shape instanceof Elt) && !isReactWidget(shape);

const isPoint = (view: ChildView | undefined) => view?.type == "buffer" || view?.type == "widget";

// A spanning wrapper continues the previous sibling when it draws the same
// element, taking in the points between them (ContentUpdate.enterSpanning).
const openWrapper = (views: ChildView[], { elt, spanning, mark }: WrapperView) => {
  let i = views.length - 1;
  while (isPoint(views[i])) i--;
  const prev = views[i];
  if (
    spanning &&
    prev?.type == "wrapper" &&
    prev.spanning &&
    prev.elt.eq(elt) &&
    sameMark(prev.mark, mark)
  ) {
    prev.children.push(...views.splice(i + 1));
    return prev;
  }
  const wrapper: WrapperChildView = { type: "wrapper", elt, spanning, children: [] };
  if (mark) wrapper.mark = mark;
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
// looking inside wrappers and past widgets out of the flow, in nothing or in a
// <br>. Undefined when `views` holds nothing to decide on. Unlike Wordgard, a
// widget rendering a <br> counts as content: its DOM doesn't exist yet.
const needsTrailingHack = (views: readonly ChildView[]): boolean | undefined => {
  for (let i = views.length - 1; i >= 0; i--) {
    const view = views[i];
    if (!view) continue;
    if (view.type == "wrapper") {
      const found = needsTrailingHack(view.children);
      if (found !== undefined) return found;
    } else if (view.type == "widget") {
      if (view.widget.type.inFlow) return false;
    } else if (view.type == "node") {
      const { shape, children } = view;
      if (!(shape instanceof Elt)) {
        if (shape.type.inFlow) return false;
        continue;
      }
      if (!children) return shape.tagName.toLowerCase() == "br";
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
  store: RenderStore;
  // The ranges this update redraws, as change sections, or null for all.
  changes: readonly number[] | null;
  // Each plot's content as last laid out, and where it started.
  layouts: WeakMap<Plot, Layout>;
  // Plots last drawn as atoms (a point shape without a hole): their layouts
  // and those inside them weren't kept up to date. Since 0.7.0, Wordgard's
  // changes no longer redraw the whole plot when its atomicity changes.
  atoms: WeakSet<Plot>;
  composition: CompositionView | null;
  // Plots down to the composition, now or in the last layout: laid out again.
  composing: ReadonlySet<Plot>;
  // The plot each plot that changed identity replaces (mapKeys).
  replaced: WeakMap<Plot, Plot>;
  // This pass: a layout it already wrote is another occurrence's of the same
  // plot object, not this one's from the last update.
  pass: object;
  words: Words;
};

// `offset` is where the plot's content starts in its parent's content (the
// doc's is 0), so the layouts inside a kept one stay right as it moves. `flat`
// when each child is a node view of its own, in order, and nothing else: its
// unchanged ends can then be kept as they are.
export type Layout = {
  offset: number;
  // The layout pass that wrote it last (LayoutContext.pass).
  pass: object;
  readonly views: readonly ChildView[];
  readonly flat: boolean;
};

// Whether views laid out with `head` and `tail` views of a flat layout kept
// are flat.
const isFlat = (plot: Plot, views: readonly ChildView[], head: number, tail: number) => {
  if (plot.isTextblock || plot.isInline || views.length != plot.content.length) return false;
  for (let i = head; i < views.length - tail; i++) if (views[i]?.type != "node") return false;
  return true;
};

// Where a plot's parent's content starts, now and in the old document (null
// when the parent is new).
type ParentStart = { readonly start: number; readonly oldStart: number | null };

// The keys of a plot's React point widgets, by position. Each keeps the key of
// an old one its position maps to, as Wordgard keeps an old widget there
// (TilePointer.matchingWidget): an equal one on the same side, else one of the
// same type, which React re-renders in place.
const pointKeys = (context: LayoutContext, old: Layout | undefined, oldStart: number | null) => {
  const byPos = new Map<number, WidgetChildView[]>();
  if (old && oldStart !== null && context.changes) {
    const map = pointMapper(context.changes);
    const collect = (views: readonly ChildView[]) => {
      for (const view of views) {
        if (view.type == "wrapper") collect(view.children);
        else if (view.type == "widget" && view.offset !== undefined)
          for (const pos of map(oldStart + view.offset)) {
            const found = byPos.get(pos);
            if (found) found.push(view);
            else byPos.set(pos, [view]);
          }
      }
    };
    collect(old.views);
  }
  const used = new Set<string>();
  return (pos: number, widget: Widget, side: number) => {
    const candidates = (byPos.get(pos) ?? []).filter(
      (view) => Math.sign(view.side) == Math.sign(side) && view.key && !used.has(view.key)
    );
    const found =
      candidates.find((view) => view.widget.eq(widget)) ??
      candidates.find((view) => view.widget.type == widget.type);
    const key = found?.key ?? createNodeKey();
    used.add(key);
    return key;
  };
};

const sources = (wrappers: readonly WrapperSource[]): WrapperView[] =>
  wrappers.map((src) =>
    wrapperView(renderWrapper(src), spanningOf(src), src instanceof Mark ? src : undefined)
  );

// A plot's content, from position `start`, for plots whose shape has a hole.
// `fresh` lays it out without its old layouts, and what it holds.
export const iterDeco = (
  context: LayoutContext,
  plot: Plot,
  start: number,
  parent: ParentStart = { start: 0, oldStart: 0 },
  fresh = false
): readonly ChildView[] => {
  const end = start + plot.contentLength;
  const oldStartOf = (layout: Layout | undefined) =>
    layout && parent.oldStart !== null ? parent.oldStart + layout.offset : null;
  // Kept only from the same place: a plot object can appear more than once.
  const fromLast = (layout: Layout | undefined) =>
    fresh || layout?.pass == context.pass ? undefined : layout;
  const previous = fromLast(context.layouts.get(plot));
  const previousStart = oldStartOf(previous);
  if (
    previous &&
    context.changes &&
    previousStart !== null &&
    samePlace(context.changes, previousStart, start) &&
    !context.composing.has(plot) &&
    isKept(context.changes, start, end)
  ) {
    previous.offset = start - parent.start;
    previous.pass = context.pass;
    return previous.views;
  }
  // The layout this plot replaces, and where it started.
  const oldPlot = context.replaced.get(plot) ?? plot;
  const old = fromLast(context.layouts.get(oldPlot));
  const oldStart = oldStartOf(old);
  const nodeKeys = context.store.keys.get(plot);
  if (!nodeKeys) throw new Error(`No keys for ${plot.name}`);
  // A flat plot's unchanged ends keep their views; the walk covers the rest.
  let head = 0;
  let tail = 0;
  // A plot object can appear more than once: only its layout from this place.
  if (
    old?.flat &&
    oldStart !== null &&
    context.changes &&
    samePlace(context.changes, oldStart, start) &&
    !context.composing.has(plot)
  )
    ({ head, tail } = unchangedEnds(context.changes, oldPlot, oldStart, plot));
  const content = plot.content;
  const middle = content.length - tail;
  let from = start;
  for (let i = 0; i < head; i++) from += content[i]?.length ?? 0;
  let to = end;
  for (let i = middle; i < content.length; i++) to -= content[i]?.length ?? 0;
  const views: ChildView[] = old && head ? old.views.slice(0, head) : [];
  const plots: { view: NodeView; plot: Plot; pos: number; fresh: boolean }[] = [];
  // Where the walk is, for point widgets.
  let at = start;
  let keyAt: ReturnType<typeof pointKeys> | null = null;
  const indexAt = new Map<number, number>();
  for (let index = head, offset = from; index < middle; index++) {
    indexAt.set(offset, index);
    offset += content[index]?.length ?? 0;
  }
  const wrapped = (wrappers: readonly WrapperView[]) => {
    let target = views;
    for (const view of wrappers) {
      const wrapper = openWrapper(target, view);
      if (view.key) wrapper.key = view.key;
      target = wrapper.children;
    }
    return target;
  };
  const nodeView = (node: Node, shape: Decoration.Shape, pos: number): NodeView => {
    const key = nodeKeys[indexAt.get(pos) ?? -1];
    if (key === undefined) throw new Error(`No key for ${node.name}`);
    return { type: "node", node, key, shape, children: null };
  };
  const walker: DecoWalker = {
    enter: (node, shape, wrappers, pos) => {
      const view = nodeView(node, shape, pos);
      wrapped(sources(wrappers)).push(view);
      plots.push({ view, plot: node, pos, fresh: fresh || context.atoms.delete(node) });
      at = pos + node.length;
      return false;
    },
    leave: () => {},
    node: (node, shape, wrappers, partial, pos) => {
      if (partial !== undefined)
        throw new Error(`${context.words.library} can't render part of ${node.name}`);
      at = pos + node.length;
      if (node.isPlot) context.atoms.add(node);
      // `Leaf.Text.of("")` still makes empty text leaves; React draws nothing for
      // them.
      if (node.is(Leaf.Text) && !node.param) return;
      let target = wrapped(sources(wrappers));
      if (!node.is(Leaf.Text)) {
        target.push(nodeView(node, shape, pos));
        return;
      }
      // A text node's attributes and wrappers become spanning wrappers.
      while (shape instanceof Elt) {
        if (isReactWrapper(shape))
          throw new Error(`A ${context.words.name} wrapper can't wrap text`);
        const elt = Elt.create(shape.tagName, shape.attrs, [0]);
        target = openWrapper(target, { elt, spanning: true }).children;
        const [inner] = shape.children;
        if (inner === undefined || inner === 0 || typeof inner == "string")
          throw new Error("Unexpected text shape");
        shape = inner;
      }
      addText(target, node.param);
    },
    nodePart: (node) => {
      throw new Error(`${context.words.library} can't render part of ${node.name}`);
    },
    widget: (widget, side, point) => {
      if (widget == Widget.img) views.push({ type: "buffer", side: side < 0 ? -1 : 1 });
      else if (point && isReactWidget(widget)) {
        keyAt ??= pointKeys(context, old, oldStart);
        views.push({
          type: "widget",
          widget,
          side,
          key: keyAt(at, widget, side),
          offset: at - start,
        });
      } else views.push({ type: "widget", widget, side });
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
    at = start + composition.layout.to;
    context.deco.walk(start + composition.layout.to, false, end, walker);
  } else {
    context.deco.walk(from, true, to, walker);
  }
  for (const { view, plot, pos, fresh } of plots)
    view.children = iterDeco(context, plot, pos + 1, { start, oldStart }, fresh);
  if (old && tail) {
    views.push(...old.views.slice(old.views.length - tail));
    // The layouts inside moved with their plots.
    for (let i = middle, pos = to; i < content.length; i++) {
      const child = content[i];
      if (!child) continue;
      const layout = child.isPlot ? context.layouts.get(child) : undefined;
      if (layout) {
        layout.offset = pos + 1 - start;
        layout.pass = context.pass;
      }
      pos += child.length;
    }
  }
  if ((plot.isTextblock || plot.isInline) && needsTrailingHack(views) !== false)
    views.push({ type: "trailingHack" });
  // From this place only: two copies of a plot mustn't share view objects.
  const fromHere =
    old && oldStart !== null && context.changes && samePlace(context.changes, oldStart, start);
  const laid = old && fromHere ? keepSame(context.store, old.views, views, head, tail) : views;
  context.layouts.set(plot, {
    offset: start - parent.start,
    pass: context.pass,
    views: laid,
    flat: isFlat(plot, laid, head, tail),
  });
  return laid;
};
