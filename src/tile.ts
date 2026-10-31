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
import { type ChildView, iterDeco, nodeShape, uneditable } from "./decorations/iterDeco.js";
import {
  type CompositeTile,
  DocTile,
  type Tile,
  TileFlag,
  getTileClasses,
} from "./wordgardInternals.js";

// One root per content element. Wordgard's tests also render into elements of
// their own, without an editor.
const roots = new WeakMap<Element, Root>();

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

// Mirrors what Wordgard's ContentUpdate builds for the same content, over the
// DOM React committed for it.
const addChildTiles = (parent: CompositeTile, views: readonly ChildView[], cursor: ChildCursor) => {
  const { EltTile, TextTile, WidgetTile } = getTileClasses();
  for (const view of views) {
    const dom = cursor.next();
    if (view.type == "text") {
      if (!(dom instanceof Text)) throw new Error("Expected a text node");
      parent.addChild(synced(new TextTile(view.text, dom)));
    } else if (view.type == "node") {
      const { node } = view;
      const tag = node.isPlot ? node.tag : node;
      const fill = (tile: CompositeTile, content: ChildCursor) => {
        if (node.isPlot) addChildTiles(tile, iterDeco(node), content);
      };
      const tile = shapeTile(nodeShape(node), tag, node.length, elementOf(dom, node.name), {
        inEditable: true,
        afterContent: 0,
        fill,
      });
      parent.addChild(tile);
    } else if (view.type == "wrapper") {
      const flags = TileFlag.Wrapper | (view.spanning ? TileFlag.Spanning : 0);
      const element = elementOf(dom, "a wrapper");
      const tile = EltTile.of(view.elt, null, flags, 0, element);
      const content = childCursor(element);
      addChildTiles(tile, view.children, content);
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

type ShapeContext = {
  inEditable: boolean;
  afterContent: number;
  // Adds the plot's content tiles at the hole.
  fill: (tile: CompositeTile, content: ChildCursor) => void;
};

// Wordgard's buildNodeShape: the node's own tile (with `tag`) or a tile for
// structure inside its shape (`tag` null).
const shapeTile = (
  shape: Elt,
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
    } else {
      const context = { inEditable: inner, afterContent: after, fill };
      tile.addChild(shapeTile(child, null, 0, elementOf(cursor.next(), child.tagName), context));
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
// it. Wordgard's `sync()` restores children and text, not attributes.
const restore = (tile: Tile) => {
  const resetAttributes = (tile: Tile) => {
    if (!(tile.flags & TileFlag.Dirty)) return;
    if (tile instanceof getTileClasses().EltTile) setAttributes(tile.dom, tile.elt.attrs);
    tile.children.forEach(resetAttributes);
  };
  resetAttributes(tile);
  tile.sync();
};

const keepsAll = (changes: readonly number[]) => {
  for (let i = 1; i < changes.length; i += 2) if (changes[i] != -1) return false;
  return true;
};

export class ReactDocTile extends DocTile {
  static create = (state: GardState, dom: Element, _wg: Wordgard) => {
    if (!roots.has(dom)) {
      // Drops what Wordgard's constructor drew before we took over.
      dom.replaceChildren();
      roots.set(dom, createRoot(dom));
    }
    checkRenderable(state.doc);
    return ReactDocTile.render(state, dom);
  };

  // Runs inside Wordgard's flush, where its DOM observer ignores mutations, so
  // React commits synchronously here.
  private static render = (state: GardState, dom: Element) => {
    const root = roots.get(dom);
    if (!root) throw new Error("No React root for this element");
    flushSync(() => root.render(createElement(DocNodeView, { doc: state.doc })));
    const tile = new ReactDocTile(state, dom, null, null);
    const cursor = childCursor(dom);
    addChildTiles(tile, iterDeco(state.doc), cursor);
    cursor.done();
    tile.length = state.doc.length;
    return synced(tile);
  };

  update(state: GardState, changes: readonly number[], _wg: Wordgard, _composition?: unknown) {
    if (state.doc == this.state.doc && keepsAll(changes)) return this;
    checkRenderable(state.doc);
    restore(this);
    return ReactDocTile.render(state, this.dom);
  }
}
