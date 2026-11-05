// A tile tree as the comparison tests compare it.
import type { Wordgard } from "wordgard/editor";

import { DocTile, type Tile } from "../wordgardInternals.js";

export const docTileOf = (wg: Wordgard) => {
  const tile = wg.contentDOM.wgTile;
  if (!(tile instanceof DocTile)) throw new Error("No DocTile");
  return tile;
};

export const pathOf = (root: Node, node: Node) => {
  const path: number[] = [];
  for (let cur = node; cur != root;) {
    const parent = cur.parentNode;
    if (!parent) throw new Error("Node outside the content");
    path.unshift([...parent.childNodes].findIndex((child) => child == cur));
    cur = parent;
  }
  return path;
};

export const describeTile = (tile: Tile, root: Node): unknown => ({
  kind: tile.isDoc ? "doc" : Object.getPrototypeOf(tile).constructor.name,
  flags: tile.flags,
  length: tile.length,
  dom: pathOf(root, tile.dom),
  children: tile.children.map((child) => describeTile(child, root)),
});

// The editor's DOM and tile tree, to compare with another editor's.
export const drawing = (wg: Wordgard) => ({
  html: wg.contentDOM.innerHTML,
  tiles: describeTile(docTileOf(wg), wg.contentDOM),
});
