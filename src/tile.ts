// Takes the role of Wordgard's own DocTile (src/editor/tile.ts in its repo):
// React draws the document and the tiles are built over React's DOM, as
// react-prosemirror's view descriptions are built over the DOM its components
// render.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { type Root, createRoot } from "react-dom/client";
import { type Attributes, type Node as DocNode, Elt, Leaf, type Plot } from "wordgard/doc";
import { Widget, type Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { attrsToRecord } from "./helpers/index.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { type RenderStore, RenderStoreContext } from "./contexts/RenderStoreContext.js";
import { DecoIterator, getDecoSet } from "./decorations/DecoIterator.js";
import {
  type ChildView,
  type Layout,
  type NodeView,
  iterDeco,
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
  type Tile,
  TileFlag,
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

// Hands out an element's children in order, checking React drew no more.
const childCursor = (dom: Element) => {
  let index = 0;
  return {
    next: () => {
      const child = dom.childNodes[index++];
      if (!child) throw new Error("React's DOM is missing a node");
      return child;
    },
    done: () => {
      if (index != dom.childNodes.length) throw new Error("React's DOM has extra nodes");
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
};

// Mirrors what Wordgard's ContentUpdate builds for the same content, over the
// DOM React committed for it.
const addChildTiles = (
  parent: CompositeTile,
  plot: Plot,
  views: readonly ChildView[],
  cursor: ChildCursor,
  context: BuildContext
) => {
  const { EltTile, TextTile, WidgetTile } = getTileClasses();
  const nodeKeys = context.keys.get(plot);
  if (!nodeKeys) throw new Error(`No keys for ${plot.name}`);
  for (const { view, key } of childViewKeys(views, nodeKeys)) {
    if (view.type == "composition" && !context.composition?.node) continue;
    const dom = cursor.next();
    if (view.type == "text") {
      if (!(dom instanceof Text)) throw new Error("Expected a text node");
      context.rendered.texts.set(dom, { key, text: view.text });
      parent.addChild(synced(new TextTile(view.text, dom)));
    } else if (view.type == "composition") {
      if (!context.composition || dom !== context.composition.node)
        throw new Error("Expected the composition's node");
      parent.addChild(compositionTile(dom, context.composition));
    } else if (view.type == "node") {
      const { node, shape, children } = view;
      // React skipped a node whose layout is the same (DefaultNodeView's memo),
      // and `restore` already undid any edit the browser made in it, so its DOM,
      // and the tiles over it, are as they were.
      const old = dom.wgTile;
      const oldView = old && tileViews.get(old);
      if (old && oldView && sameNodeView(oldView, view)) {
        parent.addChild(old);
        continue;
      }
      if (!(shape instanceof Elt)) throw new Error("react-wordgard can't render widgets yet");
      const tag = node.isPlot ? node.tag : node;
      const fill = (tile: CompositeTile, content: ChildCursor) => {
        if (node.isPlot && children) addChildTiles(tile, node, children, content, context);
      };
      const tile = shapeTile(shape, tag, node.length, elementOf(dom, node.name), {
        inEditable: true,
        afterContent: 0,
        fill,
      });
      tileViews.set(tile, view);
      parent.addChild(tile);
    } else if (view.type == "wrapper") {
      const flags = TileFlag.Wrapper | (view.spanning ? TileFlag.Spanning : 0);
      const element = elementOf(dom, "a wrapper");
      context.rendered.wrappers.set(element, key);
      const tile = EltTile.of(view.elt, null, flags, 0, element);
      const content = childCursor(element);
      addChildTiles(tile, plot, view.children, content, context);
      content.done();
      tile.length = tile.children.reduce((length, ch) => length + ch.length, 0);
      parent.addChild(synced(tile));
    } else if (view.type == "buffer") {
      const side = view.side < 0 ? TileFlag.PointBefore : TileFlag.PointAfter;
      const tile = new WidgetTile(
        Widget.img,
        null,
        TileFlag.Point | side,
        elementOf(dom, "a buffer")
      );
      parent.addChild(synced(tile));
    } else {
      const tile = new WidgetTile(
        Widget.br,
        null,
        TileFlag.Point | TileFlag.PointAfter,
        elementOf(dom, "the trailing <br>")
      );
      parent.addChild(synced(tile));
    }
  }
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
  // Adds the plot's content tiles at the hole.
  fill: (tile: CompositeTile, content: ChildCursor) => void;
};

// Wordgard's buildNodeShape: the node's own tile (with `tag`) or a tile for
// structure inside its shape (`tag` null).
const shapeTile = (
  shape: DecoElt,
  tag: DocNode.Tag | null,
  length: number,
  dom: Element,
  { inEditable, afterContent, fill }: ShapeContext
): Tile => {
  const { EltTile, WidgetTile } = getTileClasses();
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
      fill(tile, cursor);
      after = TileFlag.AfterContent;
    } else if (typeof child == "string") {
      const text = cursor.next();
      if (!(text instanceof Text)) throw new Error("Expected a text node in a shape");
      const flags = TileFlag.Point | TileFlag.NodeInner | after;
      tile.addChild(synced(new WidgetTile(Widget.text.of(child), null, flags, text)));
    } else if (child instanceof Elt) {
      const context = { inEditable: inner, afterContent: after, fill };
      tile.addChild(shapeTile(child, null, 0, elementOf(cursor.next(), child.tagName), context));
    } else {
      throw new Error("react-wordgard can't render widgets yet");
    }
  }
  cursor.done();
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
// it. Wordgard's `sync()` restores children and text, not attributes. A
// composition's node stays as the browser left it: removing it, even for a
// moment, would move the selection out of it.
const restore = (tile: Tile, composing: ChildNode | null) => {
  if (composing) keepComposing(composing);
  const resetAttributes = (tile: Tile) => {
    if (!(tile.flags & TileFlag.Dirty)) return;
    if (tile instanceof getTileClasses().EltTile) setAttributes(tile.dom, tile.elt.attrs);
    tile.children.forEach(resetAttributes);
  };
  resetAttributes(tile);
  tile.sync();
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
  composition: CompositionView | null
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
    },
    state.doc,
    0
  );
};

export class ReactDocTile extends DocTile {
  static create = (state: GardState, dom: Element, _wg: Wordgard) => {
    if (!roots.has(dom)) {
      // Drops what Wordgard's constructor drew before we took over.
      dom.replaceChildren();
      roots.set(dom, {
        root: createRoot(dom),
        store: { keys: new WeakMap() },
        rendered: { texts: new WeakMap(), wrappers: new WeakMap() },
        layouts: new WeakMap(),
        composition: null,
      });
    }
    checkRenderable(state.doc);
    const entry = rootOf(dom);
    addFreshKeys(entry.store.keys, state.doc);
    const decoSet = getDecoSet(state);
    const views = layout(state, decoSet, null, entry, null);
    return ReactDocTile.render(state, dom, decoSet, views, null);
  };

  // Runs inside Wordgard's flush, where its DOM observer ignores mutations, so
  // React commits synchronously here.
  private static render = (
    state: GardState,
    dom: Element,
    decoSet: DecoSet,
    views: readonly ChildView[],
    composition: CompositionView | null
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
    addChildTiles(tile, state.doc, views, cursor, {
      keys: entry.store.keys,
      rendered: entry.rendered,
      composition,
    });
    cursor.done();
    tile.length = state.doc.length;
    return synced(tile);
  };

  // Wordgard's own `update` diffs the decorations and calls this with the
  // ranges to redraw, decoration changes included.
  updateRanges(
    state: GardState,
    decoSet: DecoSet,
    changes: readonly number[],
    _wg: Wordgard,
    info?: CompositionInfo | null
  ) {
    const entry = rootOf(this.dom);
    const previous = entry.composition;
    if (keepsAll(changes) && !info && !previous) return this;
    checkRenderable(state.doc);
    const composition = info ? compositionView(state.doc, info, changes, entry.rendered) : null;
    const views = layout(state, decoSet, changes, entry, composition);
    const node = composition?.node ?? null;
    restore(this, node);
    // A composition that's over: React's node gets back what React committed
    // there, what the browser made goes.
    if (previous?.node && previous.node != node) {
      if (previous.rendered) previous.node.nodeValue = previous.rendered.text;
      else previous.node.remove();
    }
    mapKeys(entry.store.keys, this.state.doc, state.doc, changes);
    return ReactDocTile.render(state, this.dom, decoSet, views, composition);
  }
}
