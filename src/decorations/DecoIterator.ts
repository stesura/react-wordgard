// Copied from Wordgard 0.7.0 (src/editor/decoration.ts in its repo: DecoIterator,
// SpanIterator, getDecoSet and the shape helpers), which doesn't export them.
// Changes, so React can lay out one plot at a time:
// - `walker.enter` says whether to descend. When it doesn't, the walk goes
//   past the plot as a whole, emitting its `after` widgets once past.
// - The walker gets each node's position, and is told which widgets come from
//   point decorations.
// - A walk can start before the previous one ended.
// - Decoration sets come from the DecoSet, not from calling sources again.
// - `nodeWrappers` without wrappers returns a shared empty array, as upstream.
// - It records the document's mark behind a mark of an overridden shape
//   (`documentMark`), for React marks.
// - The element it wraps a React widget in to add attributes is marked
//   (`attributeWidget`): the view draws the widget with them as props.
// The internal classes and facets come from src/wordgardInternals.ts.
import { Attributes, Elt, Leaf, type Mark, type Node, type Plot, type Pos } from "wordgard/doc";
import { Decoration, Widget } from "wordgard/editor";
import { PointSet, RangeSet, type Set } from "wordgard/set";
import type { GardState } from "wordgard/state";

import {
  type DecoElt,
  type DecoSet,
  type TagAttribute,
  type TagWidget,
  type TagWrapper,
  type WrapperRangeDecoration,
  getDecorationInternals,
} from "../wordgardInternals.js";
import { attributeWidget } from "./widgetType.js";

const enum DecorationScope {
  Atom = 1,
  InlineAtom = 2,
  All = 4,
}

const enum WidgetPlace {
  Before,
  After,
  Start,
  End,
}

const enum Side {
  After = 1e9,
}

export type WrapperSource = Mark | WrapperRangeDecoration;

export interface DecoWalker {
  // Returns whether to walk into the plot's content.
  enter(node: Plot, shape: DecoElt, wrappers: readonly WrapperSource[], pos: number): boolean;
  leave(): void;
  node(
    node: Node,
    shape: Decoration.Shape,
    wrappers: readonly WrapperSource[],
    partial: number | undefined,
    pos: number
  ): void;
  nodePart(node: Node, length: number, done: boolean): void;
  widget(widget: Widget, side: number, point: boolean): void;
}

export const getDecoSet = (state: GardState): DecoSet => {
  const set: DecoSet = { points: new Map(), ranges: new Map() };
  for (const src of state.facet(Decoration.Point.source.reader)) set.points.set(src, src(state));
  for (const src of state.facet(Decoration.Range.source.reader)) set.ranges.set(src, src(state));
  return set;
};

const memo = <A extends object, T>(f: (arg: A) => T) => {
  const map = new WeakMap<A, T>();
  return (arg: A) => {
    let found = map.get(arg);
    if (found === undefined) map.set(arg, (found = f(arg)));
    return found;
  };
};

const addMarkAttributes = (
  overrides: Map<Mark.Type, Mark.Type>,
  shape: Decoration.Shape,
  tag: Node.Tag
) => {
  let attrs: Attributes | undefined;
  for (const mark of tag.marks) {
    const type = overrides.get(mark.type) || mark.type;
    if (type.attribute && (mark.type.spanning || !tag.isText)) {
      const { get, target } = type.attribute;
      const markAttrs = get(mark.value);
      if (markAttrs.length) {
        if (target && shape instanceof Elt) shape = shape.addAttrs(markAttrs, target);
        else attrs = attrs ? Attributes.merge(attrs, markAttrs) : markAttrs;
      }
    }
  }
  return attrs ? addAttrs(shape, attrs, tag.type.isInline) : shape;
};

const addAttrs = (shape: Decoration.Shape, attrs: Attributes, inline: boolean): Decoration.Shape =>
  shape instanceof Elt
    ? shape.addAttrs(attrs)
    : attributeWidget(shape, attrs, inline ? "span" : "div");

const applyDeco = (shape: Decoration.Shape, deco: Decoration.Point, tag: Node.Tag) => {
  const { AttributeDecoration, WrapperDecoration } = getDecorationInternals();
  if (deco instanceof AttributeDecoration) {
    return deco.selector && shape instanceof Elt
      ? shape.addAttrs(deco.attrs, deco.selector)
      : addAttrs(shape, deco.attrs, tag.type.isInline);
  } else if (deco instanceof WrapperDecoration) {
    return deco.selector && shape instanceof Elt
      ? shape.wrap(deco.elt, deco.selector)
      : deco.elt.fill([shape]);
  }
  return shape;
};

const baseTagShape = memo((tag: Node.Tag): Decoration.Shape =>
  tag.is(Leaf.Text) ? Widget.editableText.of(tag.param) : tag.type.shape.create(tag.param)
);

class SpanIterator {
  active: Decoration.Range[] = [];
  activeEnd: number[] = [];
  from: number;
  to: number;
  point: Decoration.Point | null = null;
  pointSource: Decoration.Point.Set | null = null;
  done = false;

  constructor(
    readonly ranges: Set.Cursor<Decoration.Range>,
    readonly points: Set.Cursor<Decoration.Point>,
    start: number,
    readonly end: number
  ) {
    this.from = this.to = start;
  }

  next() {
    if (this.done) return this;
    if (this.point) this.point = null;
    const { ranges, points, active, activeEnd } = this;
    for (;;) {
      const [startPos, startSide] = ranges.value
        ? [ranges.from, ranges.value.inclusiveStart ? -1 : 1]
        : [1e9, 0];
      let endPos = 1e9;
      let endSide = 0;
      let nextActive = -1;
      for (let i = 0; i < active.length; i++) {
        const pos = activeEnd[i] ?? 0;
        const side = active[i]?.inclusiveEnd ? 1 : -1;
        if ((pos - endPos || side - endSide) < 0) {
          endPos = pos;
          endSide = side;
          nextActive = i;
        }
      }
      const [pointPos, pointSide] = points.value ? [points.from, points.value.side] : [1e9, 1];
      const nextPos = Math.min(startPos, endPos, pointPos);
      if (this.to == this.end && nextPos > this.to) {
        this.done = true;
        break;
      } else if (nextPos > this.to) {
        this.from = this.to;
        this.to = Math.min(this.end, nextPos);
        break;
      } else if (
        pointPos == nextPos &&
        (startPos > pointPos || pointSide < 0) &&
        (endPos > pointPos || pointSide < 0)
      ) {
        this.point = points.value;
        this.pointSource = points.set;
        this.from = this.to = points.from;
        points.next();
        break;
      } else if ((startPos - endPos || startSide - endSide) < 0) {
        if (ranges.value) active.push(ranges.value);
        activeEnd.push(ranges.to);
        ranges.next();
      } else {
        active.splice(nextActive, 1);
        activeEnd.splice(nextActive, 1);
      }
    }
    return this;
  }
}

const tagScope = (tag: Node.Tag, atom: boolean): DecorationScope =>
  DecorationScope.All |
  (atom ? DecorationScope.Atom | (tag.type.isInline ? DecorationScope.InlineAtom : 0) : 0);

export const renderMarkWrapper = memo((mark: Mark): DecoElt => {
  const shape = mark.type.element;
  if (!shape) throw new Error(`${mark.name} has no element shape`);
  return Elt.create(shape.name, shape.attrs(mark.value), [0]);
});

// The document's mark a wrapper draws: `Decoration.Mark.shape` draws one of
// a type it clones.
const documentMarks = new WeakMap<Mark, Mark>();

export const documentMark = (mark: Mark) => documentMarks.get(mark) ?? mark;

export const renderWrapper = (src: WrapperSource): DecoElt =>
  src instanceof getDecorationInternals().WrapperRangeDecoration ? src.elt : renderMarkWrapper(src);

const compareSetPrec = (
  setA: Decoration.Point.Set,
  setB: Decoration.Point.Set,
  array: readonly Decoration.Point.Set[]
) => {
  if (setA != setB)
    for (const set of array) {
      if (set == setA) return -1;
      if (set == setB) return 1;
    }
  return 0;
};

// Where a walk ending at `target` has to stop: past the whole plot `target`
// falls inside, among the content after `pos`.
const pastPlotAt = (pos: Pos, target: number) => {
  const { content } = pos.parent.node;
  let start = pos.pos - pos.inText;
  for (let i = pos.index; i < content.length; i++) {
    const child = content[i];
    if (!child) break;
    const end = start + child.length;
    if (target < end) return child.isPlot && target > start ? end : target;
    start = end;
  }
  return target;
};

const none: readonly WrapperSource[] = [];

export class DecoIterator {
  tagShapes: Map<Node.Type, (tag: Node.Tag) => Decoration.Shape>;
  globalWidgets: readonly TagWidget[];
  globalWrappers: readonly TagWrapper[];
  globalAttrs: readonly TagAttribute[];
  markShapes: Map<Mark.Type, Mark.Type>;
  pos: Pos;
  rangeCursor: Set.Cursor<Decoration.Range>;
  pointSets: readonly Decoration.Point.Set[];
  pointCursor: Set.Cursor<Decoration.Point>;

  constructor(
    readonly state: GardState,
    readonly decoSet: DecoSet
  ) {
    const { tagShape, tagWidget, tagWrapper, tagAttribute, markShape } = getDecorationInternals();
    this.tagShapes = state.facet(tagShape.reader);
    this.globalWidgets = state.facet(tagWidget.reader);
    this.globalWrappers = state.facet(tagWrapper.reader);
    this.globalAttrs = state.facet(tagAttribute.reader);
    this.markShapes = state.facet(markShape.reader);
    this.pos = state.doc.resolve(0);
    this.rangeCursor = RangeSet.cursor([...decoSet.ranges.values()]);
    this.pointSets = [...decoSet.points.values()];
    this.pointCursor = PointSet.cursor(this.pointSets);
  }

  widgets(tag: Node.Tag, place: WidgetPlace, walker: DecoWalker) {
    if (place == WidgetPlace.Start && tag.type.isInline) walker.widget(Widget.img, -1, false);
    for (const src of this.globalWidgets) {
      if (src.place == place && tag.type == src.type) {
        const widget = typeof src.widget == "function" ? src.widget(tag) : src.widget;
        if (widget)
          walker.widget(
            widget,
            place == WidgetPlace.Before || place == WidgetPlace.End ? 1 : -1,
            false
          );
      }
    }
    if (place == WidgetPlace.End && tag.type.isInline) walker.widget(Widget.img, 1, false);
  }

  // Enumerate all wrapper elements for a given node. Spanning wrappers
  // are always moved to the front of the result. Within the
  // spanning/non-spanning wrappers, the ordering is determined by rank.
  nodeWrappers(
    tag: Node.Tag,
    active: readonly Decoration.Range[],
    atom: boolean
  ): readonly WrapperSource[] {
    const { WrapperRangeDecoration } = getDecorationInternals();
    const wrappers: WrapperSource[] = [];
    for (const mark of tag.marks) {
      const shape = this.markShapes.get(mark.type) || mark.type;
      if (shape.element) {
        const drawn = shape == mark.type ? mark : shape.of(mark.value);
        if (drawn != mark) documentMarks.set(drawn, mark);
        wrappers.push(drawn);
      }
    }
    for (const val of active) {
      if (
        val instanceof WrapperRangeDecoration &&
        tagScope(tag, atom) & val.scope &&
        (!val.query || this.state.schema.matchNode(tag.type, val.query))
      )
        wrappers.push(val);
    }
    if (!wrappers.length) return none;
    if (wrappers.length > 1)
      wrappers.sort(
        (a, b) =>
          (spanningOf(a) == spanningOf(b) ? 0 : spanningOf(a) ? -1 : 1) || rankOf(a) - rankOf(b)
      );
    return wrappers;
  }

  walk(from: number, inclusiveStart: boolean, to: number, walker: DecoWalker) {
    const { WidgetDecoration, ShapeDecoration } = getDecorationInternals();
    this.rangeCursor.goto(from);
    this.pointCursor.goto(from, inclusiveStart ? -1e9 : Side.After);
    const iter = new SpanIterator(this.rangeCursor, this.pointCursor, from, to);
    let pos =
      from >= this.pos.pos ? this.pos.advance(from - this.pos.pos) : this.state.doc.resolve(from);
    let started = inclusiveStart;
    let atomParent: Pos.Plot | undefined;
    for (let p: Pos.Plot | null = pos.parent; p; p = p.parent)
      if (!p.node.isDoc && (this.state.isAtom(p.node.type) || this.hasAtomShape(p.before)))
        atomParent = p;

    // Track points that may apply to the node at the start of the next range
    const pendingDeco: Decoration.Point[] = [];
    let pendingPos = -1;
    let pendingShape: Decoration.Shape | null = null;
    let pendingShapeSet: Decoration.Point.Set | null = null;
    // A plot the walker didn't enter: its `after` widgets come once past it.
    let skipped: Node.Tag | null = null;
    const flushSkipped = () => {
      if (!skipped) return;
      const tag = skipped;
      skipped = null;
      this.widgets(tag, WidgetPlace.After, walker);
    };

    const wrap: Pos.Walker = {
      skip: (node, pos) => {
        // Only done for leaf nodes.
        flushSkipped();
        if (started) this.widgets(node.tag, WidgetPlace.Before, walker);
        else started = true;
        const hasPending = pendingPos == pos && !node.isText;
        let shape = this.tagShape(node.tag, iter.active, hasPending ? pendingShape : null);
        if (hasPending) for (const deco of pendingDeco) shape = applyDeco(shape, deco, node.tag);
        if (shape.hasContent) throw new Error("Leaf nodes shapes shouldn't have a content hole");
        walker.node(node, shape, this.nodeWrappers(node.tag, iter.active, true), undefined, pos);
        this.widgets(node.tag, WidgetPlace.After, walker);
      },
      enterPlot: (node, pos) => {
        flushSkipped();
        if (started) this.widgets(node.tag, WidgetPlace.Before, walker);
        else started = true;
        let shape = this.tagShape(node.tag, iter.active, pendingPos == pos ? pendingShape : null);
        if (pendingPos == pos)
          for (const deco of pendingDeco) shape = applyDeco(shape, deco, node.tag);
        const wrappers = this.nodeWrappers(node.tag, iter.active, !shape.hasContent);
        const atom = !shape.hasContent;
        if (atom) {
          walker.node(node, shape, wrappers, pos + node.length > to ? to - pos : undefined, pos);
        } else {
          if (shape instanceof Elt && !walker.enter(node, shape, wrappers, pos)) {
            skipped = node.tag;
            return false;
          }
          this.widgets(node.tag, WidgetPlace.Start, walker);
        }
        return !atom;
      },
      leavePlot: (tag) => {
        flushSkipped();
        if (started && !atomParent) this.widgets(tag, WidgetPlace.End, walker);
        else started = true;
        walker.leave();
        this.widgets(tag, WidgetPlace.After, walker);
      },
    };

    if (inclusiveStart && !atomParent) {
      const before = pos.nodeBefore;
      if (before) this.widgets(before.tag, WidgetPlace.After, walker);
      else this.widgets(pos.parent.node.tag, WidgetPlace.Start, walker);
    }

    for (; !iter.next().done;) {
      if (atomParent) {
        const end = Math.min(to, atomParent.after);
        const done = atomParent.after <= to;
        walker.nodePart(atomParent.node, end - pos.pos, done);
        pos = pos.advance(end - pos.pos);
        if (done) {
          this.widgets(atomParent.node.tag, WidgetPlace.After, walker);
          atomParent = undefined;
        }
        while (iter.point && iter.from < end) iter.next();
      } else if (iter.point) {
        // Inside a plot the walk went past.
        if (iter.from < pos.pos) continue;
        flushSkipped();
        const value = iter.point;
        if (value instanceof WidgetDecoration) {
          walker.widget(value.widget, value.side, true);
        } else {
          if (pendingPos < pos.pos) {
            pendingDeco.length = 0;
            pendingShape = null;
            pendingPos = pos.pos;
          }
          if (
            value instanceof ShapeDecoration &&
            (!pendingShape ||
              (pendingShapeSet &&
                iter.pointSource &&
                compareSetPrec(pendingShapeSet, iter.pointSource, this.pointSets)))
          ) {
            pendingShape = value.shape;
            pendingShapeSet = iter.pointSource;
          } else {
            pendingDeco.push(value);
          }
        }
      } else if (iter.to > pos.pos) {
        pos = pos.walk(pastPlotAt(pos, iter.to) - pos.pos, wrap);
      }
    }
    if (pos.pos < to) pos = pos.walk(pastPlotAt(pos, to) - pos.pos, wrap);
    flushSkipped();

    if (atomParent) {
      walker.nodePart(atomParent.node, 0, atomParent.after == to);
    } else {
      const after = pos.nodeAfter;
      if (after) this.widgets(after.tag, WidgetPlace.Before, walker);
      else this.widgets(pos.parent.node.tag, WidgetPlace.End, walker);
    }
    this.pos = pos;
  }

  tagShape(tag: Node.Tag, active: readonly Decoration.Range[], fromPoint: Decoration.Shape | null) {
    const { AttributeRangeDecoration } = getDecorationInternals();
    let shape = fromPoint ?? this.tagShapes.get(tag.type)?.(tag) ?? baseTagShape(tag);
    if (tag.marks.length) shape = addMarkAttributes(this.markShapes, shape, tag);
    let add: string[] | undefined;
    for (const src of this.globalAttrs)
      if (tag.type == src.type) {
        if (src.target && shape instanceof Elt)
          shape = shape.addAttrs([src.attr, src.value(tag)], src.target);
        else Attributes.push((add ||= []), src.attr, src.value(tag));
      }
    const scope = tagScope(tag, !shape.hasContent);
    for (const { type, elt, target } of this.globalWrappers)
      if (tag.type == type) {
        shape = target && shape instanceof Elt ? shape.wrap(elt, target) : elt.fill([shape]);
      }
    for (const deco of active) {
      if (
        deco instanceof AttributeRangeDecoration &&
        scope & deco.scope &&
        (!deco.query || this.state.schema.matchNode(tag.type, deco.query))
      )
        Attributes.push((add ||= []), deco.attribute, deco.value);
    }
    if (add) {
      if (shape instanceof Elt)
        shape = Elt.create(shape.tagName, Attributes.merge(shape.attrs, add), shape.children);
      else shape = attributeWidget(shape, add, tag.type.isBlock ? "div" : "span");
    }
    return shape;
  }

  atomCache = new Map<number, boolean>();

  hasAtomShape(pos: number) {
    const { ShapeDecoration } = getDecorationInternals();
    let has = this.atomCache.get(pos);
    if (has === undefined) {
      has = this.pointSets.some((set) =>
        set.at(pos, (deco) => deco instanceof ShapeDecoration && !deco.shape.hasContent)
      );
      this.atomCache.set(pos, has);
    }
    return has;
  }
}

const rankOf = (src: WrapperSource) =>
  src instanceof getDecorationInternals().WrapperRangeDecoration ? src.rank : src.type.rank;

export const spanningOf = (src: WrapperSource) =>
  src instanceof getDecorationInternals().WrapperRangeDecoration ? src.spanning : src.type.spanning;
