// Takes the role of Wordgard's own DocTile (src/editor/tile.ts in its repo):
// React draws the document and the tiles are built over React's DOM, as
// react-prosemirror's view descriptions are built over the DOM its components
// render. Native widgets aren't React's: their DOM is rendered, reused,
// connected and placed here, following Wordgard's ContentUpdate;
// `setUneditable` is copied from it. React widgets are drawn by React, and
// connected here.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { type Root, createRoot } from "react-dom/client";
import { type Attributes, type Node as DocNode, Elt, Leaf, type Plot } from "wordgard/doc";
import { Widget, type Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { attrsToRecord } from "./helpers/index.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { type RenderStore, RenderStoreContext } from "./contexts/RenderStoreContext.js";
import { widgetRoots } from "./contexts/WidgetContext.js";
import { isReactWidget } from "./decorations/ReactWidgetType.js";
import { DecoIterator, getDecoSet } from "./decorations/DecoIterator.js";
import {
  type ChildView,
  type Layout,
  type NodeView,
  iterDeco,
  pointMapper,
  sameNodeView,
  uneditable,
} from "./decorations/iterDeco.js";
import { type CompositionView, type Rendered, browserElt, compositionView } from "./composition.js";
import { type ReactKeys, addFreshKeys, childViewKeys, mapKeys } from "./reactKeys.js";
import {
  type CompositeTile,
  type CompositionInfo,
  type DecoElt,
  type DecoSet,
  DocTile,
  Reused,
  type Tile,
  TileFlag,
  type WidgetTile,
  getTileClasses,
} from "./wordgardInternals.js";

// One root and render store per content element. Wordgard's tests also render
// into elements of their own, without an editor.
// `rendered` records what React committed into text nodes and wrapper
// elements, `layouts` each plot's content as last laid out, and `composition`
// the last render's composition.
const roots = new WeakMap<
  Element,
  {
    root: Root;
    store: RenderStore;
    rendered: Rendered;
    layouts: WeakMap<Plot, Layout>;
    composition: CompositionView | null;
  }
>();

const rootOf = (dom: Element) => {
  const found = roots.get(dom);
  if (!found) throw new Error("No React root for this element");
  return found;
};

// The layout each node tile was built for, so a node React skipped keeps its
// tiles.
const tileViews = new WeakMap<Tile, NodeView>();

// Throws for what React can't render yet, rather than drawing it wrong.
const checkRenderable = (plot: Plot) => {
  for (const node of plot.content) {
    if (node.is(Leaf.Text)) continue;
    const shape = node.isPlot
      ? node.type.shape.create(node.tag.param)
      : node.type.shape.create(node.param);
    checkShape(node.name, shape);
    if (node.isPlot && shape.hasContent) checkRenderable(node);
  }
};

// React can't draw an empty text node, nor namespaced elements from a tag name.
const checkShape = (name: string, shape: Elt) => {
  if (/^(svg|math):/.test(shape.tagName))
    throw new Error(`react-wordgard can't render the shape of ${name} yet`);
  for (const child of shape.children) {
    if (child === "") throw new Error(`react-wordgard can't render the shape of ${name} yet`);
    if (child instanceof Elt) checkShape(name, child);
  }
};

// DOM the tile builder owns: widgets, which React draws nothing for.
const widgetDOM = new WeakSet<Node>();

// Puts the widget DOM in `order` where it goes, leaving React's nodes where
// React put them: their order is right, and moving a connected node blurs it
// and fires its custom element callbacks. Returns the widget DOM left over.
const placeWidgets = (dom: Element, order: readonly ChildNode[]) => {
  const wanted = new Set(order);
  let at = dom.firstChild;
  for (const node of order) {
    while (at && !wanted.has(at)) at = at.nextSibling;
    if (at == node) at = node.nextSibling;
    else if (widgetDOM.has(node)) dom.insertBefore(node, at);
    // React's node is further on: the widgets before it come later in `order`.
    else at = node.nextSibling;
  }
  return [...dom.childNodes].filter((child) => !wanted.has(child));
};

// Hands out the children React drew in an element, in order, past widget DOM,
// and collects the order all its children must have.
const childCursor = (dom: Element) => {
  let last: ChildNode | null = null;
  let widgets = false;
  const order: ChildNode[] = [];
  const after = () => (last ? last.nextSibling : dom.firstChild);
  return {
    next: () => {
      let child = after();
      for (; child && widgetDOM.has(child); child = child.nextSibling) widgets = true;
      if (!child) throw new Error("React's DOM is missing a node");
      last = child;
      order.push(child);
      return child;
    },
    place: (node: ChildNode) => {
      widgets = true;
      order.push(node);
    },
    // Checks React drew no more, puts the widget DOM in place and returns what
    // the element no longer holds.
    done: () => {
      for (let child = after(); child; child = child.nextSibling) {
        if (!widgetDOM.has(child)) throw new Error("React's DOM has extra nodes");
        widgets = true;
      }
      return widgets ? placeWidgets(dom, order) : [];
    },
  };
};

type ChildCursor = ReturnType<typeof childCursor>;

const elementOf = (dom: ChildNode, what: string) => {
  if (!(dom instanceof Element)) throw new Error(`Expected an element for ${what}`);
  return dom;
};

type BuildContext = {
  keys: ReactKeys;
  rendered: Rendered;
  composition: CompositionView | null;
  wg: Wordgard;
  // The update's sections, null when drawing from scratch.
  changes: readonly number[] | null;
  // Tiles of the previous tree used again, as Wordgard's ContentUpdate records
  // them for `Tile.disconnect` (kept nodes only when that tree had widgets),
  // and new widget tiles to connect.
  reused: Map<Tile, number>;
  oldWidgets: boolean;
  toConnect: Tile[];
  // Widget DOM placed in this build, widget DOM elements dropped, and widgets
  // the DOM observer saw changed (not reused, as in Wordgard).
  taken: Set<Node>;
  strays: ChildNode[];
  dirty: ReadonlySet<Node>;
};

// Whether the token at `pos` in the new document is in a range the update
// redraws: Wordgard rebuilds a node starting there (buildNodeShape), so the
// widgets of its shape are reused for their DOM and connected anew.
const redrawn = (changes: readonly number[] | null, pos: number) => {
  if (!changes) return false;
  for (let i = 0, posB = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    const end = posB + (ins < 0 ? len : ins);
    if (pos < end) return ins != -1;
    posB = end;
  }
  return false;
};

// The widget tiles a plot's content had, under `old`, the tile that held it,
// by their position in the new document. Built on first use.
type WidgetPool = { old: Tile | null; byPos: Map<number, Tile[]> | null };

const widgetPool = (old: Tile | null): WidgetPool => ({ old, byPos: null });

const widgetsAt = (pool: WidgetPool, context: BuildContext, pos: number) => {
  if (!pool.byPos) {
    const byPos = new Map<number, Tile[]>();
    const { old } = pool;
    if (old && context.changes) {
      const map = pointMapper(context.changes);
      const collect = (tile: Tile, start: number) => {
        let pos = start;
        for (const child of tile.children) {
          if (widgetDOM.has(child.dom)) {
            for (const at of map(pos)) {
              const found = byPos.get(at);
              if (found) found.push(child);
              else byPos.set(at, [child]);
            }
          } else if (!child.tag && !child.isNodeInner) {
            collect(child, pos);
          }
          pos += child.length;
        }
      };
      collect(old, old.posAtStart);
    }
    pool.byPos = byPos;
  }
  return pool.byPos.get(pos) ?? [];
};

// The first widget tile among `tiles`, not used yet, that `match` accepts.
const findWidget = (
  tiles: readonly Tile[],
  context: BuildContext,
  match: (tile: WidgetTile) => boolean
) => {
  const { WidgetTile } = getTileClasses();
  for (const tile of tiles)
    if (tile instanceof WidgetTile && !context.taken.has(tile.dom) && match(tile)) return tile;
  return null;
};

// Records a widget tile's DOM as placed at the cursor, to connect when `fresh`.
const placeWidget = (tile: Tile, cursor: ChildCursor, context: BuildContext, fresh: boolean) => {
  widgetDOM.add(tile.dom);
  context.taken.add(tile.dom);
  cursor.place(tile.dom);
  if (fresh) context.toConnect.push(tile);
  return synced(tile);
};

// Wordgard's setUneditable. It wraps a text node in a <span> its sync then
// takes the text back out of (docs/wordgard-upstream-bugs.md), so text is left
// as it is here.
const setUneditable = (dom: Element | Text) => {
  if (
    dom instanceof HTMLElement &&
    dom.contentEditable == "inherit" &&
    !/^(br|hr|img|input|wbr)$/i.test(dom.nodeName)
  )
    dom.contentEditable = "false";
};

const pointSide = (side: number) =>
  side < 0 ? TileFlag.PointBefore : side > 0 ? TileFlag.PointAfter : 0;

// A React widget's tile, over the root element its component forwarded its ref
// to. The tile there before is kept whole where `keep` says Wordgard would keep
// it; otherwise it's disconnected and the new one connected, over the same DOM
// when React re-rendered the component in place.
const reactWidgetTile = (
  dom: ChildNode,
  context: BuildContext,
  keep: (old: WidgetTile) => boolean,
  create: (dom: Element) => WidgetTile
): Tile => {
  if (!(dom instanceof Element) || !widgetRoots.has(dom))
    throw new Error("A React widget's component must forward its ref to its root element");
  const { WidgetTile } = getTileClasses();
  const old = dom.wgTile;
  context.taken.add(dom);
  if (old instanceof WidgetTile && keep(old)) {
    context.reused.set(old, Reused.Full);
    return old;
  }
  if (old) context.reused.set(old, Reused.DOM);
  const tile = create(dom);
  context.toConnect.push(tile);
  return synced(tile);
};

// Mirrors what Wordgard's ContentUpdate builds for the same content, from
// position `start`, over the DOM React committed for it, and puts widget DOM,
// which React doesn't draw, in place.
const addChildTiles = (
  parent: CompositeTile,
  plot: Plot,
  views: readonly ChildView[],
  cursor: ChildCursor,
  context: BuildContext,
  pool: WidgetPool,
  start: number
) => {
  const { EltTile, TextTile, WidgetTile } = getTileClasses();
  const nodeKeys = context.keys.get(plot);
  if (!nodeKeys) throw new Error(`No keys for ${plot.name}`);
  let pos = start;
  const add = (tile: Tile) => {
    parent.addChild(tile);
    pos += tile.length;
  };
  for (const { view, key } of childViewKeys(views, nodeKeys)) {
    if (view.type == "composition" && !context.composition?.node) continue;
    if (view.type == "widget") {
      // TilePointer.matchingWidget: an equal point widget on the same side,
      // unchanged in the DOM, is kept whole. A React widget's old tile is the
      // one over the element React kept.
      const { widget } = view;
      const side = pointSide(view.side);
      const matching = (tile: WidgetTile) =>
        !tile.tag &&
        !tile.isNodeInner &&
        (tile.flags & (TileFlag.PointBefore | TileFlag.PointAfter)) == side &&
        !context.dirty.has(tile.dom) &&
        tile.widget.eq(widget);
      if (isReactWidget(widget)) {
        const tile = reactWidgetTile(cursor.next(), context, matching, (dom) => {
          if (!widget.type.editable) setUneditable(dom);
          return new WidgetTile(widget, null, TileFlag.Point | side, dom);
        });
        add(tile);
        continue;
      }
      const old = findWidget(widgetsAt(pool, context, pos), context, matching);
      if (old) {
        context.reused.set(old, Reused.Full);
        add(placeWidget(old, cursor, context, false));
        continue;
      }
      const dom = widget.render(context.wg);
      if (!widget.type.editable) setUneditable(dom);
      const tile = new WidgetTile(widget, null, TileFlag.Point | side, dom);
      add(placeWidget(tile, cursor, context, true));
      continue;
    }
    if (view.type == "node" && !(view.shape instanceof Elt)) {
      // A node drawn as a widget (buildNodeShape): kept whole where React would
      // skip it, else drawn with an equal widget's DOM and connected anew.
      const { node, shape } = view;
      const tag = node.isPlot ? node.tag : node;
      if (isReactWidget(shape)) {
        const keep = (old: WidgetTile) => {
          const oldView = tileViews.get(old);
          return !!oldView && sameNodeView(oldView, view) && !redrawn(context.changes, pos);
        };
        const tile = reactWidgetTile(cursor.next(), context, keep, (dom) => {
          if (!shape.type.editable) setUneditable(dom);
          return new WidgetTile(shape, tag, TileFlag.Atom, dom, node.length);
        });
        tileViews.set(tile, view);
        add(tile);
        continue;
      }
      const old = findWidget(
        widgetsAt(pool, context, pos),
        context,
        (tile) => !!tile.tag && tile.widget.eq(shape)
      );
      const oldView = old && tileViews.get(old);
      if (old && oldView && sameNodeView(oldView, view) && !redrawn(context.changes, pos)) {
        context.reused.set(old, Reused.Full);
        add(placeWidget(old, cursor, context, false));
        continue;
      }
      if (old) context.reused.set(old, Reused.DOM);
      const dom = old ? old.dom : shape.render(context.wg);
      if (!shape.type.editable) setUneditable(dom);
      const tile = new WidgetTile(shape, tag, TileFlag.Atom, dom, node.length);
      tileViews.set(tile, view);
      add(placeWidget(tile, cursor, context, true));
      continue;
    }
    const dom = cursor.next();
    if (view.type == "text") {
      if (!(dom instanceof Text)) throw new Error("Expected a text node");
      context.rendered.texts.set(dom, { key, text: view.text });
      add(synced(new TextTile(view.text, dom)));
    } else if (view.type == "composition") {
      if (!context.composition || dom !== context.composition.node)
        throw new Error("Expected the composition's node");
      add(compositionTile(dom, context.composition));
    } else if (view.type == "node") {
      const { node, shape, children } = view;
      // React skipped a node whose layout is the same (DefaultNodeView's memo),
      // and `restore` already undid any edit the browser made in it, so its DOM,
      // and the tiles over it, are as they were.
      const old = dom.wgTile;
      const oldView = old && tileViews.get(old);
      if (old && oldView && sameNodeView(oldView, view)) {
        // An atom's tile holds its shape's widgets: reconnected where redrawn.
        if (context.oldWidgets) {
          if (!children && redrawn(context.changes, pos)) context.toConnect.push(old);
          else context.reused.set(old, Reused.Full);
        }
        add(old);
        continue;
      }
      if (!(shape instanceof Elt)) throw new Error("Expected an element shape");
      const tag = node.isPlot ? node.tag : node;
      // Wordgard rebuilds a node's shape only where the node itself is
      // redrawn, not just its content: the widgets in a kept shape stay whole.
      const oldTag = oldView && (oldView.node.isPlot ? oldView.node.tag : oldView.node);
      const keepShape =
        !!oldTag?.eq(tag) && !!oldView?.shape.eq(shape) && !redrawn(context.changes, pos);
      const contentStart = pos + 1;
      const fill = (tile: CompositeTile, content: ChildCursor, pool: WidgetPool) => {
        if (node.isPlot && children)
          addChildTiles(tile, node, children, content, context, pool, contentStart);
      };
      const tile = shapeTile(shape, tag, node.length, elementOf(dom, node.name), {
        inEditable: true,
        afterContent: 0,
        keepShape,
        fill,
        context,
      });
      tileViews.set(tile, view);
      add(tile);
    } else if (view.type == "wrapper") {
      const flags = TileFlag.Wrapper | (view.spanning ? TileFlag.Spanning : 0);
      const element = elementOf(dom, "a wrapper");
      context.rendered.wrappers.set(element, key);
      const tile = EltTile.of(view.elt, null, flags, 0, element);
      const content = childCursor(element);
      addChildTiles(tile, plot, view.children, content, context, pool, pos);
      finish(content, context);
      tile.length = tile.children.reduce((length, ch) => length + ch.length, 0);
      add(synced(tile));
    } else if (view.type == "buffer") {
      const side = view.side < 0 ? TileFlag.PointBefore : TileFlag.PointAfter;
      const tile = new WidgetTile(
        Widget.img,
        null,
        TileFlag.Point | side,
        elementOf(dom, "a buffer")
      );
      add(synced(tile));
    } else {
      const tile = new WidgetTile(
        Widget.br,
        null,
        TileFlag.Point | TileFlag.PointAfter,
        elementOf(dom, "the trailing <br>")
      );
      add(synced(tile));
    }
  }
};

// Done with an element: the widget DOM it no longer holds is removed at the end
// of the build, unless used elsewhere.
const finish = (cursor: ChildCursor, context: BuildContext) => {
  context.strays.push(...cursor.done());
};

// A tile for an element the browser put around composed text.
const browserTile = (dom: Element) => getTileClasses().EltTile.of(browserElt(dom), null, 0, 0, dom);

// The composed text's tile, flagged as Wordgard flags it, inside tiles for the
// elements the browser put around it (ContentUpdate.composition).
const compositionTile = (dom: ChildNode, composition: CompositionView): Tile => {
  const { TextTile } = getTileClasses();
  if (dom instanceof Text) return synced(new TextTile(composition.text, dom, TileFlag.Composition));
  const element = elementOf(dom, "the composition");
  const inner = [...element.childNodes].find((child) => child.contains(composition.target));
  if (!inner) throw new Error("Expected the composition's node");
  const tile = browserTile(element);
  tile.addChild(compositionTile(inner, composition));
  tile.length = composition.text.length;
  return synced(tile);
};

type ShapeContext = {
  inEditable: boolean;
  afterContent: number;
  keepShape: boolean;
  // Adds the plot's content tiles at the hole; `pool` knows what the element
  // there held before.
  fill: (tile: CompositeTile, content: ChildCursor, pool: WidgetPool) => void;
  context: BuildContext;
};

// Wordgard's buildNodeShape: the node's own tile (with `tag`) or a tile for
// structure inside its shape (`tag` null).
const shapeTile = (
  shape: DecoElt,
  tag: DocNode.Tag | null,
  length: number,
  dom: Element,
  { inEditable, afterContent, keepShape, fill, context }: ShapeContext
): Tile => {
  const { EltTile, WidgetTile } = getTileClasses();
  const previous = dom.wgTile ?? null;
  const { shape: elt, inEditable: inner } = uneditable(shape, inEditable);
  const flags = tag
    ? elt.hasContent
      ? 0
      : TileFlag.Atom
    : TileFlag.NodeInner | (elt.hasContent ? 0 : TileFlag.Point);
  const tile = EltTile.of(elt, tag, flags | afterContent, tag ? length : 0, dom);
  const cursor = childCursor(dom);
  let after = 0;
  for (const child of elt.children) {
    if (child === 0) {
      tile.flags |= TileFlag.PlotContent;
      fill(tile, cursor, widgetPool(previous));
      after = TileFlag.AfterContent;
    } else if (typeof child == "string") {
      const text = cursor.next();
      if (!(text instanceof Text)) throw new Error("Expected a text node in a shape");
      const flags = TileFlag.Point | TileFlag.NodeInner | after;
      tile.addChild(synced(new WidgetTile(Widget.text.of(child), null, flags, text)));
    } else if (child instanceof Elt) {
      const inside = { inEditable: inner, afterContent: after, keepShape, fill, context };
      tile.addChild(shapeTile(child, null, 0, elementOf(cursor.next(), child.tagName), inside));
    } else if (isReactWidget(child)) {
      const flags = TileFlag.Point | TileFlag.NodeInner | after;
      const keep = (old: WidgetTile) => keepShape && old.isNodeInner && old.widget.eq(child);
      const widget = reactWidgetTile(cursor.next(), context, keep, (dom) => {
        if (inner && !child.type.editable) setUneditable(dom);
        return new WidgetTile(child, null, flags, dom);
      });
      tile.addChild(widget);
    } else {
      // A widget in the shape: kept whole in a kept shape, else an equal one's
      // DOM is used again (findReusableTile) and connected anew.
      const old = findWidget(
        previous?.children ?? [],
        context,
        (tile) => tile.isNodeInner && tile.widget.eq(child)
      );
      if (old && keepShape) {
        context.reused.set(old, Reused.Full);
        tile.addChild(placeWidget(old, cursor, context, false));
        continue;
      }
      if (old) context.reused.set(old, Reused.DOM);
      const dom = old ? old.dom : child.render(context.wg);
      if (inner && !child.type.editable) setUneditable(dom);
      const flags = TileFlag.Point | TileFlag.NodeInner | after;
      tile.addChild(placeWidget(new WidgetTile(child, null, flags, dom), cursor, context, true));
    }
  }
  finish(cursor, context);
  // What `sync()` computes for tiles whose length follows their children.
  if (!(tile.flags & TileFlag.Atom))
    tile.length = tile.children.reduce((sum, ch) => sum + ch.length, tile.boundary * 2);
  return synced(tile);
};

// The flag Wordgard's `sync()` sets once a tile's DOM matches it.
const synced = <T extends { flags: number }>(tile: T) => {
  tile.flags |= TileFlag.Synced;
  return tile;
};

const setAttributes = (dom: Element, attrs: Attributes) => {
  const wanted = attrsToRecord(attrs);
  for (const name of dom.getAttributeNames())
    if (!Object.hasOwn(wanted, name)) dom.removeAttribute(name);
  for (const [name, value] of Object.entries(wanted))
    if (dom.getAttribute(name) != value) dom.setAttribute(name, value);
};

// Puts back the DOM React committed where the browser or a script changed it
// (the tiles Wordgard's DOM observer marked Dirty), so React's diff applies to
// it. Wordgard's `sync()` restores children and text, not attributes, and
// keeps widget DOM, which the old tiles hold. A composition's node stays as
// the browser left it: removing it, even for a moment, would move the
// selection out of it. Returns the widgets that were changed, which `sync()`
// marks clean.
const restore = (tile: Tile, composing: ChildNode | null) => {
  if (composing) keepComposing(composing);
  const { EltTile, WidgetTile } = getTileClasses();
  const dirty = new Set<Node>();
  const resetAttributes = (tile: Tile) => {
    if (!(tile.flags & TileFlag.Dirty)) return;
    if (tile instanceof EltTile) setAttributes(tile.dom, tile.elt.attrs);
    else if (tile instanceof WidgetTile) dirty.add(tile.dom);
    tile.children.forEach(resetAttributes);
  };
  resetAttributes(tile);
  tile.sync();
  return dirty;
};

// Makes the old tree hold the composition's node as it is, so `sync()` leaves
// it: its tiles marked clean, or a clean tile of its own when the browser made
// it, where it sits among its siblings.
const keepComposing = (node: ChildNode) => {
  const parent = node.parentNode?.wgTile;
  const own = node.wgTile;
  const clean = (tile: Tile) => {
    tile.flags &= ~TileFlag.Dirty;
    tile.children.forEach(clean);
  };
  if (own && own.parent == parent) {
    clean(own);
    return;
  }
  if (!(parent instanceof DocTile || parent instanceof getTileClasses().EltTile)) return;
  let index = parent.children.length;
  for (let next = node.nextSibling; next; next = next.nextSibling) {
    const found = parent.children.findIndex((child) => child.dom == next);
    if (found > -1) {
      index = found;
      break;
    }
  }
  const { TextTile } = getTileClasses();
  const tile =
    node instanceof Text
      ? new TextTile(node.nodeValue ?? "", node, TileFlag.Composition)
      : browserTile(elementOf(node, "the composition"));
  parent.children.splice(index, 0, synced(tile));
  tile.parent = parent;
};

const keepsAll = (changes: readonly number[]) => {
  for (let i = 1; i < changes.length; i += 2) if (changes[i] != -1) return false;
  return true;
};

type Entry = NonNullable<ReturnType<typeof roots.get>>;

// Lays out the document from Wordgard's decorations, keeping the layout of
// plots outside the ranges `changes` redraws (all, without changes).
const layout = (
  state: GardState,
  decoSet: DecoSet,
  changes: readonly number[] | null,
  entry: Entry,
  composition: CompositionView | null,
  replaced: WeakMap<Plot, Plot>
) => {
  const previous = entry.composition;
  const composing = new Set<Plot>();
  for (const view of [previous, composition])
    if (view) for (const plot of [state.doc, view.plot, ...view.path]) composing.add(plot);
  return iterDeco(
    {
      deco: new DecoIterator(state, decoSet),
      changes,
      layouts: entry.layouts,
      composition,
      composing,
      replaced,
    },
    state.doc,
    0
  );
};

export class ReactDocTile extends DocTile {
  // Whether this tree, or one before it, held widget DOM: those get
  // disconnected when dropped.
  widgets = false;

  static create = (state: GardState, dom: Element, wg: Wordgard) => {
    if (!roots.has(dom)) {
      // Drops what Wordgard's constructor drew before we took over.
      dom.replaceChildren();
      roots.set(dom, {
        root: createRoot(dom),
        store: { keys: new WeakMap(), wg },
        rendered: { texts: new WeakMap(), wrappers: new WeakMap() },
        layouts: new WeakMap(),
        composition: null,
      });
    }
    checkRenderable(state.doc);
    const entry = rootOf(dom);
    addFreshKeys(entry.store.keys, state.doc);
    const decoSet = getDecoSet(state);
    const views = layout(state, decoSet, null, entry, null, new WeakMap());
    return ReactDocTile.render(state, dom, decoSet, views, {
      wg,
      old: null,
      changes: null,
      dirty: new Set(),
    });
  };

  // Runs inside Wordgard's flush, where its DOM observer ignores mutations, so
  // React commits synchronously here. Then builds the tiles, puts widget DOM
  // in place, and connects and disconnects widgets as Wordgard's updateRanges
  // does.
  private static render = (
    state: GardState,
    dom: Element,
    decoSet: DecoSet,
    views: readonly ChildView[],
    {
      wg,
      old,
      changes,
      dirty,
      composition = null,
    }: {
      wg: Wordgard;
      old: ReactDocTile | null;
      changes: readonly number[] | null;
      dirty: ReadonlySet<Node>;
      composition?: CompositionView | null;
    }
  ) => {
    const entry = rootOf(dom);
    entry.composition = composition;
    flushSync(() =>
      entry.root.render(
        createElement(
          RenderStoreContext.Provider,
          { value: entry.store },
          createElement(DocNodeView, { doc: state.doc, views })
        )
      )
    );
    const tile = new ReactDocTile(state, dom, composition?.wrapCursor ?? null, decoSet);
    const cursor = childCursor(dom);
    const context: BuildContext = {
      keys: entry.store.keys,
      rendered: entry.rendered,
      composition,
      wg,
      changes,
      reused: new Map(),
      oldWidgets: !!old?.widgets,
      toConnect: [],
      taken: new Set(),
      strays: [],
      dirty,
    };
    addChildTiles(tile, state.doc, views, cursor, context, widgetPool(old), 0);
    finish(cursor, context);
    for (const stray of context.strays) if (!context.taken.has(stray)) stray.remove();
    tile.length = state.doc.length;
    tile.widgets = context.oldWidgets || context.taken.size > 0;
    if (wg.connected) {
      if (old?.widgets) for (const child of old.children) child.disconnect(context.reused);
      for (const widget of context.toConnect) widget.connect();
    }
    return synced(tile);
  };

  // Wordgard's own `update` diffs the decorations and calls this with the
  // ranges to redraw, decoration changes included.
  updateRanges(
    state: GardState,
    decoSet: DecoSet,
    changes: readonly number[],
    wg: Wordgard,
    info?: CompositionInfo | null
  ) {
    const entry = rootOf(this.dom);
    const previous = entry.composition;
    if (keepsAll(changes) && !info && !previous) return this;
    checkRenderable(state.doc);
    const composition = info ? compositionView(state.doc, info, changes, entry.rendered) : null;
    const replaced = mapKeys(entry.store.keys, this.state.doc, state.doc, changes);
    const views = layout(state, decoSet, changes, entry, composition, replaced);
    const node = composition?.node ?? null;
    const dirty = restore(this, node);
    // A composition that's over: React's node gets back what React committed
    // there, what the browser made goes.
    if (previous?.node && previous.node != node) {
      if (previous.rendered) previous.node.nodeValue = previous.rendered.text;
      else previous.node.remove();
    }
    return ReactDocTile.render(state, this.dom, decoSet, views, {
      wg,
      old: this,
      changes,
      dirty,
      composition,
    });
  }
}
