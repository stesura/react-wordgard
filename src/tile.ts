// Takes the role of Wordgard's own DocTile (src/editor/tile.ts in its repo):
// React draws the document and the tiles are built over React's DOM, as
// react-prosemirror's view descriptions are built over the DOM its components
// render.
import { createElement } from "react";
import { flushSync } from "react-dom";
import { type Root, createRoot } from "react-dom/client";
import { type Attributes, Leaf, type Plot } from "wordgard/doc";
import { Widget, type Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { attrsToRecord } from "./helpers/index.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { type ChildView, iterDeco, plotShape } from "./decorations/iterDeco.js";
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
    if (node.isPlot) {
      const { children } = node.type.shape.create(node.tag.param);
      if (node.isInline || node.type.shape.atom || children.length != 1 || children[0] !== 0)
        throw new Error(`react-wordgard can't render the shape of ${node.name} yet`);
      checkRenderable(node);
    } else if (!node.is(Leaf.Text)) {
      throw new Error(`react-wordgard can't render ${node.name} yet`);
    }
  }
};

// Mirrors what Wordgard's ContentUpdate builds for the same content, over the
// DOM React committed for it.
const addChildTiles = (parent: CompositeTile, views: readonly ChildView[], dom: Element) => {
  const { EltTile, TextTile, WidgetTile } = getTileClasses();
  const childDOM = dom.childNodes;
  if (childDOM.length != views.length) throw new Error("React's DOM doesn't match the layout");
  views.forEach((view, i) => {
    const child = childDOM[i];
    if (view.type == "text") {
      if (!(child instanceof Text)) throw new Error("Expected a text node");
      parent.addChild(synced(new TextTile(view.text, child)));
      return;
    }
    if (!(child instanceof Element)) throw new Error(`Expected an element for ${view.type}`);
    if (view.type == "node") {
      const { node } = view;
      const tile = EltTile.of(
        plotShape(node.tag),
        node.tag,
        TileFlag.PlotContent,
        node.length,
        child
      );
      addChildTiles(tile, iterDeco(node), child);
      parent.addChild(synced(tile));
    } else if (view.type == "wrapper") {
      const flags = TileFlag.Wrapper | (view.spanning ? TileFlag.Spanning : 0);
      const tile = EltTile.of(view.elt, null, flags, 0, child);
      addChildTiles(tile, view.children, child);
      tile.length = tile.children.reduce((length, ch) => length + ch.length, 0);
      parent.addChild(synced(tile));
    } else {
      parent.addChild(
        synced(new WidgetTile(Widget.br, null, TileFlag.Point | TileFlag.PointAfter, child))
      );
    }
  });
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
    addChildTiles(tile, iterDeco(state.doc), dom);
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
