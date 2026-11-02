// Takes the role of Wordgard's own DocTile (src/editor/tile.ts in its repo):
// React draws the document and the tiles are built over React's DOM, as
// react-prosemirror's view descriptions are built over the DOM its components
// render. Native widgets aren't React's: their DOM is rendered, reused,
// connected and placed here, following Wordgard's ContentUpdate;
// `setUneditable` is copied from it. React widgets are drawn by React, and
// connected here. React commits into a root of its own, or, for an editor
// WordgardEditor hosts, a portal in the app's tree (WordgardDoc).
import { type ReactElement, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import {
  type Attributes,
  type Node as DocNode,
  Elt,
  Leaf,
  type Mark,
  type Plot,
} from "wordgard/doc";
import { Widget, type Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { attrsToRecord } from "./helpers/index.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { stopsEvent } from "./contexts/DecorationContext.js";
import { EditorContext, editorOf } from "./contexts/EditorContext.js";
import { type RenderStore, RenderStoreContext } from "./contexts/RenderStoreContext.js";
import { viewRoots } from "./viewRoots.js";
import { contentOf, isReactShape, shapeOfRoot, sortRecords } from "./decorations/ReactShapeType.js";
import { attributedWidget, isReactWidget, widgetRoots } from "./decorations/ReactWidgetType.js";
import { isReactWrapper } from "./decorations/ReactWrapperType.js";
import { markOfTile, markTiles } from "./decorations/ReactMarkType.js";
import { DecoIterator, getDecoSet } from "./decorations/DecoIterator.js";
import {
  type ChildView,
  type Layout,
  type NodeView,
  iterDeco,
  sameNodeView,
  uneditable,
} from "./decorations/iterDeco.js";
import { pointMapper, redrawn } from "./changes.js";
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

// The portal WordgardDoc draws a hosted editor's document through. Its layout
// effect reports each element it commits; `mount` builds the tiles over its
// first commit. Each portal `claim`s the editor first, so `mount` can refuse a
// second one.
export type DocPortal = {
  readonly get: () => ReactElement;
  readonly subscribe: (listener: () => void) => () => void;
  readonly committed: (element: ReactElement) => void;
  readonly claim: () => () => void;
  readonly mount: () => void;
};

type Laid = { state: GardState; decoSet: DecoSet; views: readonly ChildView[] };

// One React tree and render store per content element. Wordgard's tests also
// render into elements of their own, without an editor.
// `commit` renders an element there (inside flushSync), `portal` is set for a
// hosted editor, with `reached` telling whether an element got committed and
// `revert` handing React back the last one committed, `last` is what was last
// rendered (for the portal to mount).
// `rendered` records what React committed into text nodes and wrapper
// elements, `layouts` each plot's content as last laid out, and `composition`
// the last render's composition.
const roots = new WeakMap<
  Element,
  {
    commit: (element: ReactElement) => void;
    portal: DocPortal | null;
    reached: (element: ReactElement) => boolean;
    revert: () => void;
    last: Laid | null;
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
// tiles, and the tile built for each node view.
const tileViews = new WeakMap<Tile, NodeView>();
const viewTiles = new WeakMap<NodeView, Tile>();

// For tests: the layout a node's tile was built for.
export const nodeViewOf = (tile: Tile) => tileViews.get(tile);

// Plots already checked: they never change.
const renderable = new WeakSet<Plot>();

// Throws for what React can't render yet, rather than drawing it wrong.
const checkRenderable = (plot: Plot) => {
  if (renderable.has(plot)) return;
  for (const node of plot.content) {
    // A checked plot's shape was checked with it.
    if (node.is(Leaf.Text) || (node.isPlot && renderable.has(node))) continue;
    const shape = node.isPlot
      ? node.type.shape.create(node.tag.param)
      : node.type.shape.create(node.param);
    checkShape(node.name, shape);
    if (node.isPlot && shape.hasContent) checkRenderable(node);
  }
  renderable.add(plot);
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

// Elements that held widget DOM after the last build.
const holdsWidgets = new WeakSet<Element>();

const noChrome: ReadonlySet<Node> = new Set();

// Hands out the children React drew in an element, in order, past widget DOM
// and a React shape's `chrome` beside its content, and collects the order all
// its children must have.
const childCursor = (dom: Element, chrome: ReadonlySet<Node> = noChrome) => {
  let last: ChildNode | null = null;
  let widgets = false;
  const order: ChildNode[] = [];
  const after = () => (last ? last.nextSibling : dom.firstChild);
  return {
    // Whether `skip` may be used: with widget DOM among the children, which
    // React doesn't draw, the cursor has to walk them to find what goes.
    canSkip: !holdsWidgets.has(dom) && !chrome.size,
    // Takes a node React left where it was, without reading the DOM.
    skip: (node: ChildNode) => {
      last = node;
      order.push(node);
    },
    next: () => {
      let child = after();
      for (; child && (widgetDOM.has(child) || chrome.has(child)); child = child.nextSibling) {
        if (widgetDOM.has(child)) {
          widgets = true;
        } else {
          last = child;
          order.push(child);
        }
      }
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
        if (chrome.has(child)) {
          order.push(child);
          continue;
        }
        if (!widgetDOM.has(child)) throw new Error("React's DOM has extra nodes");
        widgets = true;
      }
      if (!widgets) {
        holdsWidgets.delete(dom);
        return [];
      }
      holdsWidgets.add(dom);
      return placeWidgets(dom, order);
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
  // Roots of React shapes whose structure changed since the last build.
  changedShapes: ReadonlySet<Element>;
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
// which React doesn't draw, in place. `kept` when React kept the element the
// views are drawn in, in an update: its children are then as React left them.
const addChildTiles = (
  parent: CompositeTile,
  plot: Plot,
  views: readonly ChildView[],
  cursor: ChildCursor,
  context: BuildContext,
  pool: WidgetPool,
  start: number,
  kept: boolean
) => {
  const { EltTile, TextTile, WidgetTile } = getTileClasses();
  let pos = start;
  const add = (tile: Tile) => {
    parent.addChild(tile);
    pos += tile.length;
  };
  for (const { view, key } of childViewKeys(views)) {
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
    // In a kept element, a view laid out before, the same object, is one React
    // skipped (DefaultNodeView's memo): its DOM and tile are as they were.
    const same = kept && cursor.canSkip && view.type == "node" ? viewTiles.get(view) : undefined;
    const dom = same ? same.dom : cursor.next();
    if (same) cursor.skip(same.dom);
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
      const old = same ?? dom.wgTile;
      const oldView = old && tileViews.get(old);
      if (old && oldView && sameNodeView(oldView, view) && !holdsChanged(old, context)) {
        // An atom's tile holds its shape's widgets: reconnected where redrawn.
        if (context.oldWidgets) {
          if (!children && redrawn(context.changes, pos)) context.toConnect.push(old);
          else context.reused.set(old, Reused.Full);
        }
        viewTiles.set(view, old);
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
        // The element at the hole had a tile: React kept it.
        const kept = !!context.changes && !!pool.old;
        if (node.isPlot && children)
          addChildTiles(tile, node, children, content, context, pool, contentStart, kept);
      };
      const tile = shapeTile(shape, tag, node.length, elementOf(dom, node.name), {
        inEditable: true,
        container: isContainer(node),
        afterContent: 0,
        keepShape,
        fill,
        context,
      });
      tileViews.set(tile, view);
      viewTiles.set(view, tile);
      add(tile);
    } else if (view.type == "wrapper") {
      const flags = TileFlag.Wrapper | (view.spanning ? TileFlag.Spanning : 0);
      const element = elementOf(dom, "a wrapper");
      context.rendered.wrappers.set(element, key);
      const wrapperKept = kept && !!element.wgTile;
      if (view.mark) {
        const fill = (tile: CompositeTile, content: ChildCursor, contentKept: boolean) =>
          addChildTiles(tile, plot, view.children, content, context, pool, pos, contentKept);
        const tile = reactMarkTile(view, view.mark, flags, element, context, fill, wrapperKept);
        markViews.set(tile, { view, plot });
        add(tile);
        continue;
      }
      const tile = EltTile.of(view.elt, null, flags, 0, element);
      const content = childCursor(element);
      addChildTiles(tile, plot, view.children, content, context, pool, pos, wrapperKept);
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
  // Whether the plot's content is blocks, beside which a React shape may draw
  // chrome in the content element.
  container: boolean;
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
  shapeContext: ShapeContext
): Tile => {
  if (isReactShape(shape) || isReactWrapper(shape))
    return reactShapeTile(shape, tag, length, dom, shapeContext);
  const attributed = attributedWidget(shape);
  if (attributed) return attributedWidgetTile(attributed, tag, length, dom, shapeContext);
  const { inEditable, afterContent, keepShape, fill, context } = shapeContext;
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
      const inside = { ...shapeContext, inEditable: inner, afterContent: after };
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

// A React widget with the attributes Wordgard would wrap it in an element for:
// the view draws the widget alone, its attributes as props.
const attributedWidgetTile = (
  widget: Widget,
  tag: DocNode.Tag | null,
  length: number,
  dom: Element,
  { inEditable, afterContent, keepShape, context }: ShapeContext
): Tile => {
  const { WidgetTile } = getTileClasses();
  const flags = (tag ? TileFlag.Atom : TileFlag.Point | TileFlag.NodeInner) | afterContent;
  const keep = (old: WidgetTile) => keepShape && old.widget.eq(widget);
  return reactWidgetTile(dom, context, keep, (dom) => {
    if (inEditable && !widget.type.editable) setUneditable(dom);
    return new WidgetTile(widget, tag, flags, dom, tag ? length : 0);
  });
};

// What a React shape's component draws besides the content element and the
// elements around it. Its tiles are uneditable widgets, as a widget inside a
// shape is: Wordgard ignores mutations in them, and positions skip them.
const chrome = Widget.define<null>({
  render: () => {
    throw new Error("React draws a shape's chrome");
  },
  propagateEvent: (event) => !stopsEvent(event),
}).of(null);

// Tiles over a React shape's elements: React's attributes, not the shape's.
const shapeTiles = new WeakSet<Tile>();

const addChromeTile = (tile: CompositeTile, child: ChildNode, flags: number) => {
  if (!(child instanceof Element || child instanceof Text)) return;
  if (child instanceof Element) setUneditable(child);
  const { WidgetTile } = getTileClasses();
  tile.addChild(synced(new WidgetTile(chrome, null, flags, child)));
};

type MarkChildView = Extract<ChildView, { type: "wrapper" }>;

// The view and plot each React mark's tile was built for, and the tile holding
// its content.
const markViews = new WeakMap<Tile, { view: MarkChildView; plot: Plot }>();
const markContents = new WeakMap<Tile, Tile>();

// A React mark's tiles, over the DOM its component committed: a wrapper tile
// for its root, and for each element down to its content element, as Wordgard's
// `resolve` walks nested wrappers. Everything else is chrome, a point widget
// beside the content. The content element holds only the content: its text
// couldn't be told from chrome's. `fill` adds the content's tiles, `kept` when
// React kept that element.
const reactMarkTile = (
  view: MarkChildView,
  mark: Mark,
  flags: number,
  dom: Element,
  context: BuildContext,
  fill: (tile: CompositeTile, content: ChildCursor, kept: boolean) => void,
  kept: boolean
): Tile => {
  const { EltTile } = getTileClasses();
  const handle = shapeOfRoot(dom);
  if (!handle || handle.wrapper)
    throw new Error(
      "A React mark's component must draw a DecorationRoot, or forward its ref to its root element"
    );
  if (dom.localName != view.elt.tagName) warnElement("mark", view.elt.tagName, dom.localName);
  const content = contentOf(handle) ?? dom;
  if (!dom.contains(content)) throw new Error("A React mark's content element is outside it");
  // Content React remounted in another element: its widget DOM, which React
  // doesn't remove, comes out, to be reused from the pool or dropped.
  const old = dom.wgTile && markContents.get(dom.wgTile);
  const moved = !!old && old.dom != content;
  if (old && moved) removeWidgetDOM(old, content);
  let contentTile: Tile | null = null;
  const build = (element: Element, elt: DecoElt, flags: number): Tile => {
    const tile = EltTile.of(elt, null, flags, 0, element);
    shapeTiles.add(tile);
    markTiles.add(tile);
    if (element == content) {
      const cursor = childCursor(element);
      fill(tile, cursor, kept && !moved);
      finish(cursor, context);
      contentTile = tile;
    } else {
      for (const child of [...element.childNodes]) {
        if (child instanceof Element && child.contains(content))
          tile.addChild(build(child, Elt.mk(child.localName, [0]), TileFlag.Wrapper));
        else addChromeTile(tile, child, TileFlag.Point);
      }
    }
    tile.length = tile.children.reduce((sum, ch) => sum + ch.length, 0);
    return synced(tile);
  };
  const tile = build(dom, view.elt, flags);
  markOfTile.set(tile, mark);
  if (contentTile) markContents.set(tile, contentTile);
  return tile;
};

// A React shape's or wrapper's tiles, over the DOM its component committed:
// walked from the DOM, as the component decides its structure. The elements
// from the root to the content element (a wrapper: to the element it wraps)
// are its structure, everything else is chrome.
const reactShapeTile = (
  elt: DecoElt,
  tag: DocNode.Tag | null,
  length: number,
  dom: Element,
  shapeContext: ShapeContext
): Tile => {
  const { afterContent, container, fill, context } = shapeContext;
  const { EltTile, WidgetTile } = getTileClasses();
  const handle = shapeOfRoot(dom);
  const what = isReactWrapper(elt) ? "wrapper" : "shape";
  if (!handle || handle.wrapper != (what == "wrapper"))
    throw new Error(
      `A React ${what}'s component must draw a DecorationRoot, or forward its ref to its root element`
    );
  if (dom.localName != elt.tagName) warnElement(what, elt.tagName, dom.localName);
  if (handle.wrapper && !handle.content)
    throw new Error("A React wrapper's component must draw its children");
  const atom = !handle.wrapper && !elt.hasContent;
  if (atom && handle.content)
    throw new Error("A React shape drawing an atom has no content: drop its contentDOMRef");
  const content = atom ? null : (contentOf(handle) ?? dom);
  if ((content && !dom.contains(content)) || (handle.wrapper && content == dom))
    throw new Error(
      `A React ${what}'s ${handle.wrapper ? "children are" : "content element is"} outside it`
    );
  // A wrapper around an atom: uneditable, as Wordgard makes a shape without a
  // hole.
  const { inEditable } = uneditable(elt, shapeContext.inEditable);
  if (!inEditable && shapeContext.inEditable) setUneditable(dom);
  // Content React remounted in another element: the widget DOM placed in the
  // old one, which React doesn't remove, comes out (to be reused from the
  // pool, or dropped), and the old content's widgets make the pool.
  const old = !handle.wrapper && dom.wgTile ? contentTile(dom.wgTile) : null;
  const moved = old && old.dom != content ? old : null;
  if (moved) for (const child of moved.children) if (widgetDOM.has(child.dom)) child.dom.remove();
  // The same for what a wrapper wrapped: React may have remounted it, or made
  // its element structure (same name, so React kept it, widget DOM included).
  if (handle.wrapper && content && dom.wgTile) removeWidgetDOM(dom.wgTile, content);
  // What a wrapper wraps: the node's shape or an element in it, or the widget
  // drawing the node.
  const wrappedTile = (element: Element, after: number): Tile => {
    const [child] = elt.children;
    const inside = { ...shapeContext, inEditable, afterContent: after };
    if (child instanceof Elt) return shapeTile(child, null, 0, element, inside);
    if (child === undefined || child === 0 || typeof child == "string" || !isReactWidget(child))
      throw new Error("A React wrapper wraps an element or a React widget");
    const flags = TileFlag.Point | TileFlag.NodeInner | after;
    const keep = (old: WidgetTile) =>
      shapeContext.keepShape && old.isNodeInner && old.widget.eq(child);
    return reactWidgetTile(element, context, keep, (dom) => {
      if (inEditable && !child.type.editable) setUneditable(dom);
      return new WidgetTile(child, null, flags, dom);
    });
  };
  const addChrome = (tile: CompositeTile, child: ChildNode, after: number) =>
    addChromeTile(tile, child, TileFlag.Point | TileFlag.NodeInner | after);
  const build = (element: Element, elt: DecoElt, tag: DocNode.Tag | null, flags: number): Tile => {
    const previous = element.wgTile ?? null;
    const tile = EltTile.of(elt, tag, flags, tag ? length : 0, element);
    shapeTiles.add(tile);
    if (element == content && !handle.wrapper) {
      tile.flags |= TileFlag.PlotContent;
      // In a container, what isn't a node's or a widget's DOM is chrome, before
      // or after the content, which React draws as one run.
      const children = [...element.childNodes];
      const isChrome = (child: ChildNode) => container && !isContentDOM(child);
      const first = children.findIndex((child) => !isChrome(child));
      const last = children.findLastIndex((child) => !isChrome(child));
      if (children.slice(first, last + 1).some(isChrome))
        throw new Error("A React shape's chrome is between its content's nodes");
      const before = first < 0 ? children : children.slice(0, first);
      const after = first < 0 ? [] : children.slice(last + 1);
      for (const child of before) addChrome(tile, child, 0);
      const cursor = childCursor(element, new Set([...before, ...after]));
      fill(tile, cursor, widgetPool(moved ?? previous));
      for (const child of after) addChrome(tile, child, TileFlag.AfterContent);
      finish(cursor, context);
    } else {
      let after = 0;
      for (const child of [...element.childNodes]) {
        if (handle.wrapper && child == content) {
          tile.addChild(wrappedTile(content, after));
          after = TileFlag.AfterContent;
        } else if (child instanceof Element && child.contains(content)) {
          const structure = Elt.mk(child.localName, hole ? [0] : []);
          tile.addChild(build(child, structure, null, innerFlags | after));
          after = TileFlag.AfterContent;
        } else {
          addChrome(tile, child, after);
        }
      }
    }
    if (!(tile.flags & TileFlag.Atom))
      tile.length = tile.children.reduce((sum, ch) => sum + ch.length, tile.boundary * 2);
    return synced(tile);
  };
  // Without a hole (a wrapper around an atom), Wordgard's flags for a shape
  // without content.
  const hole = elt.hasContent;
  const innerFlags = TileFlag.NodeInner | (hole ? 0 : TileFlag.Point);
  const flags = tag ? (hole ? 0 : TileFlag.Atom) : innerFlags;
  return build(dom, elt, tag, flags | afterContent);
};

// Takes the widget DOM under `tile` out of the page, unless it's in `keep`.
const removeWidgetDOM = (tile: Tile, keep: Element) => {
  for (const child of tile.children) {
    if (!widgetDOM.has(child.dom)) removeWidgetDOM(child, keep);
    else if (!keep.contains(child.dom)) child.dom.remove();
  }
};

// A plot whose content is blocks: no text, so no browser edits in its content
// element itself.
const isContainer = (node: DocNode) => node.isPlot && !node.isTextblock && !node.isInline;

// Whether a React shape's content is text, from the node its tile was built
// for (records only come once it's built).
// The node tile a React shape's or wrapper's root is drawn in.
const nodeTileOf = (root: Element) => {
  let tile = root.wgTile;
  while (tile && !tile.tag) tile = tile.parent ?? undefined;
  return tile;
};

const holdsText = (root: Element) => {
  const tile = nodeTileOf(root);
  const view = tile && tileViews.get(tile);
  return !view || !isContainer(view.node);
};

// The DOM a container's content is made of: elements React drew for nodes,
// mark wrappers and React widgets, and native widgets' DOM.
const isContentDOM = (node: ChildNode) =>
  widgetDOM.has(node) ||
  (node instanceof Element &&
    (viewRoots.has(node) || !!shapeOfRoot(node) || widgetRoots.has(node)));

const isChromeTile = (tile: Tile) =>
  tile instanceof getTileClasses().WidgetTile && tile.widget == chrome;

const warned = new Set<string>();

// A React shape, wrapper or mark whose component's root isn't the element its Elt
// names: `target` selectors match the Elt, and plain Wordgard draws it.
const warnElement = (what: "shape" | "wrapper" | "mark", expected: string, found: string) => {
  const key = `${what}:${expected}>${found}`;
  if (warned.has(key)) return;
  warned.add(key);
  const fix = {
    shape: `draw the element its shape says (the node type's, or the one given to \`of\`), or pass <${found}> to \`of\``,
    wrapper: "give createWrapper the element its component draws",
    mark: "give createMarkShape the element its component draws",
  }[what];
  console.error(
    `A React ${what}'s component drew <${found}> where its ${what} says <${expected}>: ${fix}`
  );
};

// Whether a React shape whose structure changed is drawn in a tile's DOM: the
// tile can't be kept whole.
const holdsChanged = (tile: Tile, context: BuildContext) => {
  for (const root of context.changedShapes) if (tile.dom.contains(root)) return true;
  return false;
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
    if (tile instanceof EltTile && !shapeTiles.has(tile)) setAttributes(tile.dom, tile.elt.attrs);
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

type BuildOptions = {
  wg: Wordgard;
  old: ReactDocTile | null;
  changes: readonly number[] | null;
  dirty: ReadonlySet<Node>;
  composition?: CompositionView | null;
};

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
      pass: {},
      keys: entry.store.keys,
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

const newEntry = (commit: Entry["commit"]): Entry => ({
  commit,
  portal: null,
  reached: () => true,
  revert: () => {},
  last: null,
  store: { keys: new WeakMap() },
  rendered: { texts: new WeakMap(), wrappers: new WeakMap() },
  layouts: new WeakMap(),
  composition: null,
});

const docElement = (wg: Wordgard, entry: Entry, views: readonly ChildView[]) =>
  createElement(
    EditorContext.Provider,
    { value: editorOf(wg) },
    createElement(
      RenderStoreContext.Provider,
      { value: entry.store },
      createElement(DocNodeView, { views })
    )
  );

// The first layout, keys included.
const firstLayout = (state: GardState, entry: Entry): Laid => {
  checkRenderable(state.doc);
  addFreshKeys(entry.store.keys, state.doc);
  const decoSet = getDecoSet(state);
  return { state, decoSet, views: layout(state, decoSet, null, entry, null, new WeakMap()) };
};

// What `render` throws when React can't commit inside the flush (a flush from
// inside a React render or commit); ReactWordgard asks for another.
export class RefusedUpdate extends Error {}

export const docPortal = (dom: Element) => {
  const { portal } = rootOf(dom);
  if (!portal) throw new Error("This editor isn't hosted by WordgardEditor");
  return portal;
};

export class ReactDocTile extends DocTile {
  // Whether this tree, or one before it, held widget DOM: those get
  // disconnected when dropped.
  widgets = false;

  static create = (state: GardState, dom: Element, wg: Wordgard) => {
    if (!roots.has(dom)) {
      // Wordgard's own tests build trees in elements already drawn.
      dom.replaceChildren();
      const root = createRoot(dom);
      roots.set(
        dom,
        newEntry((element) => root.render(element))
      );
    }
    const { decoSet, views } = firstLayout(state, rootOf(dom));
    return ReactDocTile.render(state, dom, decoSet, views, {
      wg,
      old: null,
      changes: null,
      dirty: new Set(),
    });
  };

  // For an editor WordgardEditor hosts: React draws the document when
  // WordgardDoc mounts its portal, which then calls `mount`. Until then the
  // tree is empty; Wordgard doesn't flush an editor that isn't in the page.
  static host = (state: GardState, dom: Element, wg: Wordgard, mount: () => void) => {
    dom.replaceChildren();
    let element: ReactElement | null = null;
    let committed: ReactElement | null = null;
    const listeners = new Set<() => void>();
    let claims = 0;
    const portal: DocPortal = {
      get: () => {
        if (!element) throw new Error("Nothing to render yet");
        return element;
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      committed: (element) => {
        committed = element;
      },
      claim: () => {
        claims++;
        return () => {
          claims--;
        };
      },
      // The editor's element and content element exist once: a second
      // WordgardDoc would move the first's element and draw the document
      // twice into one content element.
      mount: () => {
        if (claims > 1) throw new Error("This editor is already rendered by another WordgardDoc");
        mount();
      },
    };
    const entry = newEntry((next) => {
      element = next;
      for (const listener of listeners) listener();
    });
    entry.portal = portal;
    entry.reached = (element) => committed == element;
    entry.revert = () => {
      element = committed;
    };
    roots.set(dom, entry);
    const laid = firstLayout(state, entry);
    entry.last = laid;
    element = docElement(wg, entry, laid.views);
    return new ReactDocTile(state, dom, null, laid.decoSet);
  };

  // Builds the tiles over what the portal committed, for its first commit or
  // a commit after it was unmounted.
  static mount = (dom: Element, wg: Wordgard, old: DocTile) => {
    const { last } = rootOf(dom);
    if (!last) throw new Error("Nothing rendered to mount");
    return ReactDocTile.build(last.state, dom, last.decoSet, last.views, {
      wg,
      old: old instanceof ReactDocTile ? old : null,
      changes: null,
      dirty: new Set(),
    });
  };

  // Runs inside Wordgard's flush, where its DOM observer ignores mutations, so
  // React commits synchronously here, with the state the hooks read. Then
  // builds the tiles.
  private static render = (
    state: GardState,
    dom: Element,
    decoSet: DecoSet,
    views: readonly ChildView[],
    options: BuildOptions
  ) => {
    const entry = rootOf(dom);
    const editor = editorOf(options.wg);
    const element = docElement(options.wg, entry, views);
    const before = { state: editor.store.getState(), last: entry.last };
    entry.last = { state, decoSet, views };
    flushSync(() => {
      editor.publish(state);
      entry.commit(element);
    });
    // flushSync defers inside a React render or commit, and the tiles can't
    // be built over DOM React hasn't committed. React renders what the stores
    // then hold, so it gets back what it last committed, and Wordgard, which
    // keeps the update pending, redraws on its next flush.
    if (!entry.reached(element)) {
      entry.last = before.last;
      entry.revert();
      editor.publish(before.state);
      throw new RefusedUpdate(
        "ReactWordgard can't update while React renders or commits: read the editor's layout from useEditorEffect or useEditorLayoutEffect, not from a React effect"
      );
    }
    return ReactDocTile.build(state, dom, decoSet, views, options);
  };

  // Builds the tiles over the DOM React committed, puts widget DOM in place,
  // and connects and disconnects widgets as Wordgard's updateRanges does.
  private static build = (
    state: GardState,
    dom: Element,
    decoSet: DecoSet,
    views: readonly ChildView[],
    { wg, old, changes, dirty, composition = null }: BuildOptions
  ) => {
    const entry = rootOf(dom);
    entry.composition = composition;
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
      changedShapes: takeShapeChanges(wg),
    };
    // Wordgard's content element stays; React's children in it only in an
    // update (a mount draws them anew).
    addChildTiles(tile, state.doc, views, cursor, context, widgetPool(old), 0, !!changes && !!old);
    finish(cursor, context);
    for (const stray of context.strays) if (!context.taken.has(stray)) stray.remove();
    // What the build itself moved (widget DOM, strays) isn't a shape's change.
    takeShapeChanges(wg);
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
    const editor = editorOf(wg);
    if (editor.measures.size) wg.scheduleDOMRead(editor.readMeasures);
    const previous = entry.composition;
    if (keepsAll(changes) && !info && !previous) {
      flushSync(() => editor.publish(state));
      // React decorations drawing from the state committed there, and no build
      // follows to take their changes.
      rebuildRoots(takeShapeChanges(wg), wg);
      return this;
    }
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

// The tile holding a plot's content, inside a node tile's shape.
const contentTile = (tile: Tile): Tile | null => {
  if (tile.flags & TileFlag.PlotContent) return tile;
  for (const child of tile.children) {
    const found = child.isNodeInner ? contentTile(child) : null;
    if (found) return found;
  }
  return null;
};

// What a rebuild outside the flush builds with.
const rebuildContext = (wg: Wordgard): BuildContext => {
  const entry = rootOf(wg.contentDOM);
  const length = entry.last?.state.doc.length;
  return {
    keys: entry.store.keys,
    rendered: entry.rendered,
    composition: entry.composition,
    wg,
    // Nothing changed in the document: widgets map to where they were.
    changes: length === undefined ? null : [length, -1],
    reused: new Map(),
    oldWidgets: false,
    toConnect: [],
    taken: new Set(),
    strays: [],
    dirty: new Set(),
    changedShapes: new Set(),
  };
};

// Puts the content's old tiles in `tile` when React kept its element: they're
// over the same DOM, in the same order.
const keepContent = (
  old: Tile,
  tile: CompositeTile,
  cursor: ChildCursor,
  context: BuildContext
) => {
  for (const child of old.children) {
    if (isChromeTile(child)) continue;
    if (widgetDOM.has(child.dom)) cursor.place(child.dom);
    else if (cursor.next() != child.dom) throw new Error("A React decoration's content moved");
    context.reused.set(child, Reused.Full);
    tile.addChild(child);
  }
};

// Puts a rebuilt tile in the old one's place, and connects and disconnects as
// the build does.
const replaceTile = (old: Tile, tile: Tile, context: BuildContext) => {
  const { parent } = old;
  if (!parent) return;
  parent.children[parent.children.indexOf(old)] = tile;
  tile.parent = parent;
  // Wordgard finds a tile from its DOM and checks the tree owns it: the old one
  // and its DOM, now React's elsewhere, are out of the tree.
  old.parent = null;
  for (const stray of context.strays) if (!context.taken.has(stray)) stray.remove();
  // What wasn't kept is disconnected: the content React remounted, and the
  // widgets around it in a wrapped shape React remounted.
  if (context.wg.connected) {
    old.disconnect(context.reused);
    for (const widget of context.toConnect) widget.connect();
  }
};

// Builds a React shape's node tile again over React's DOM, outside the flush,
// after its component committed on its own: the content's tiles are kept when
// the content element is the same, built again from their views when React
// remounted it.
const rebuildShape = (old: Tile, wg: Wordgard) => {
  const view = tileViews.get(old);
  // Gone with content an earlier rebuild found remounted.
  if (!old.dom.isConnected) return;
  if (!view || !old.parent || !(view.shape instanceof Elt)) return;
  const context = rebuildContext(wg);
  const { node, shape, children } = view;
  const oldContent = contentTile(old);
  const contentStart = old.posBefore + 1;
  const fill = (tile: CompositeTile, cursor: ChildCursor, pool: WidgetPool) => {
    if (oldContent && oldContent.dom == tile.dom) keepContent(oldContent, tile, cursor, context);
    else if (node.isPlot && children)
      addChildTiles(tile, node, children, cursor, context, pool, contentStart, false);
  };
  const tag = node.isPlot ? node.tag : node;
  const tile = shapeTile(shape, tag, node.length, elementOf(old.dom, node.name), {
    inEditable: true,
    container: isContainer(node),
    afterContent: 0,
    keepShape: true,
    fill,
    context,
  });
  tileViews.set(tile, view);
  viewTiles.set(view, tile);
  replaceTile(old, tile, context);
};

// The same for a React mark's tile.
const rebuildMark = (old: Tile, wg: Wordgard) => {
  const found = markViews.get(old);
  const mark = markOfTile.get(old);
  if (!old.dom.isConnected || !found || !mark || !old.parent) return;
  const { view, plot } = found;
  const context = rebuildContext(wg);
  const oldContent = markContents.get(old);
  const pos = old.posBefore;
  const fill = (tile: CompositeTile, cursor: ChildCursor) => {
    if (oldContent && oldContent.dom == tile.dom) keepContent(oldContent, tile, cursor, context);
    else
      addChildTiles(
        tile,
        plot,
        view.children,
        cursor,
        context,
        widgetPool(oldContent ?? null),
        pos,
        false
      );
  };
  const flags = old.flags & (TileFlag.Wrapper | TileFlag.Spanning);
  const tile = reactMarkTile(view, mark, flags, elementOf(old.dom, "a mark"), context, fill, false);
  markViews.set(tile, found);
  replaceTile(old, tile, context);
};

// Each ReactWordgard's DOM observer's MutationObserver, replaced so records
// are sorted before Wordgard reads them (`sortRecords`), and the React shapes
// whose structure changed.
const shapeObservers = new WeakMap<
  Wordgard,
  { observer: MutationObserver; changed: Set<Element>; discard: () => void }
>();

export const observeShapes = (wg: Wordgard, queue: (records: MutationRecord[]) => void) => {
  const changed = new Set<Element>();
  // Wordgard also takes records outside the flush (`focus`, through `clear`):
  // the shapes are rebuilt there too, before it reads the tiles.
  class ShapeObserver extends MutationObserver {
    takeRecords() {
      const kept = sortRecords(super.takeRecords(), changed, holdsText);
      rebuildShapes(wg);
      return kept;
    }

    // What the rebuild itself moved (widget DOM, strays), not an edit.
    discard() {
      super.takeRecords();
    }
  }
  const observer = new ShapeObserver((records) => {
    const kept = sortRecords(records, changed, holdsText);
    if (kept.length) queue(kept);
    rebuildShapes(wg);
  });
  shapeObservers.set(wg, { observer, changed, discard: () => observer.discard() });
  return observer;
};

// The React shapes whose structure changed, for the build in the flush.
const takeShapeChanges = (wg: Wordgard): ReadonlySet<Element> => {
  const found = shapeObservers.get(wg);
  if (!found) return new Set();
  found.observer.takeRecords();
  const changed = new Set(found.changed);
  found.changed.clear();
  return changed;
};

// Rebuilds, outside the flush, the tiles of the React shapes whose component
// changed their structure; the flush's build does it inside.
export const rebuildShapes = (wg: Wordgard) => {
  const found = shapeObservers.get(wg);
  if (!found || editorOf(wg).flushing || !roots.has(wg.contentDOM)) return;
  if (!found.changed.size) return;
  rebuildRoots(found.changed, wg);
  found.changed.clear();
  found.discard();
};

// A node holding several changed roots (a React wrapper and the shape it
// wraps) is rebuilt once, whole. A React mark's tile is rebuilt on its own.
const rebuildRoots = (changed: ReadonlySet<Element>, wg: Wordgard) => {
  const tiles = new Set<Tile>();
  for (const root of changed) {
    const mark = root.wgTile && markOfTile.has(root.wgTile) ? root.wgTile : undefined;
    const tile = root.isConnected ? (mark ?? nodeTileOf(root)) : undefined;
    if (tile) tiles.add(tile);
  }
  for (const tile of tiles)
    if (markOfTile.has(tile)) rebuildMark(tile, wg);
    else rebuildShape(tile, wg);
};
