// Named after our react-prosemirror fork's RenderStoreContext, rewritten for
// Wordgard: what the view computes for rendering, held in one object per
// content element and provided once, so its context value never changes and
// memoised node views are never scanned for it. ReactDocTile writes it inside
// Wordgard's flush, before React renders.
import { createContext, useContext } from "react";

import type { NodeView } from "../decorations/iterDeco.js";
import type { ReactKeys } from "../reactKeys.js";

// A node view's place in its list, kept while the node keeps its key there
// (iterDeco's keepSame). Its component (DefaultNodeView) reads its view from
// it and listens to it, so a list whose shape didn't change isn't rendered
// again for one of its nodes to be.
export type NodeCell = {
  view: NodeView;
  listener: (() => void) | null;
};

export type RenderStore = {
  readonly keys: ReactKeys;
  // Views laid out for cells, given to them at the next commit. Kept through a
  // refused update or a render error: the layouts that update wrote stay.
  readonly pending: Map<NodeCell, NodeView>;
};

const cells = new WeakMap<NodeView, NodeCell>();

export const cellOf = (view: NodeView) => {
  let cell = cells.get(view);
  if (!cell) cells.set(view, (cell = { view, listener: null }));
  return cell;
};

// `view` takes the place of `old`, its node's view in the last layout.
export const moveCell = (store: RenderStore, old: NodeView, view: NodeView) => {
  const cell = cellOf(old);
  cells.set(view, cell);
  if (cell.view == view) store.pending.delete(cell);
  else store.pending.set(cell, view);
};

// Gives the cells their views, inside the commit's flushSync. Returns what
// takes them back, for an update React refused.
export const publishCells = (store: RenderStore) => {
  const before: [NodeCell, NodeView][] = [];
  for (const [cell, view] of store.pending) {
    before.push([cell, cell.view]);
    cell.view = view;
    cell.listener?.();
  }
  return () => {
    for (const [cell, view] of before) cell.view = view;
  };
};

export const RenderStoreContext = createContext<RenderStore | null>(null);

export const useRenderStore = () => {
  const store = useContext(RenderStoreContext);
  if (!store) throw new Error("Rendered outside a ReactDocTile");
  return store;
};
