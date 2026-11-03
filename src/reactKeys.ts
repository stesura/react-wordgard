// Named after react-prosemirror's reactKeys plugin, rewritten for Wordgard: no
// plugin, since Wordgard hands the view its changes. Keys are kept per parent
// plot, by child index, so rendering needs no positions and a plot that
// keeps its identity keeps its keys without any work.
import type { Node, Plot } from "wordgard/doc";
import type { Widget } from "wordgard/editor";

import { mapNodePos, unchangedEnds } from "./changes.js";
import type { ChildView } from "./decorations/iterDeco.js";

// The React keys of each plot's children, by index in its content. Text
// children get none: their keys come from their neighbours (ChildNodeViews).
export type ReactKeys = WeakMap<Plot, readonly string[]>;

export const createNodeKey = () => Math.floor(Math.random() * 0xffffffffffff).toString(16);

// Gives keys to `plot` and everything in it that has none yet.
export const addFreshKeys = (keys: ReactKeys, plot: Plot) => {
  if (keys.has(plot)) return;
  keys.set(
    plot,
    plot.content.map((child) => (child.isText ? "" : createNodeKey()))
  );
  for (const child of plot.content) if (child.isPlot) addFreshKeys(keys, child);
};

// Carries keys from `oldDoc` to `newDoc` through `changes` (the sections
// DocTile.update receives), as react-prosemirror maps them through a
// transaction's steps: a node whose start survives keeps its key, as does a
// node moved within its parent (the same object); others get fresh ones. Only
// plots that changed identity are visited. Returns, for each
// of those, the plot it replaces.
export const mapKeys = (
  keys: ReactKeys,
  oldDoc: Plot,
  newDoc: Plot,
  changes: readonly number[]
) => {
  const replaced = new WeakMap<Plot, Plot>();
  const mapChildren = (oldPlot: Plot, oldStart: number, newPlot: Plot, newStart: number) => {
    if (keys.has(newPlot)) return;
    replaced.set(newPlot, oldPlot);
    const oldKeys = keys.get(oldPlot) ?? [];
    // The children at both ends are the same nodes at the same places: they
    // keep their keys, and only the middle is mapped.
    const { head, tail } = unchangedEnds(changes, oldPlot, oldStart, newPlot);
    const before = oldPlot.content;
    const after = newPlot.content;
    const oldTail = before.length - tail;
    const newTail = after.length - tail;
    // Only the middle is walked node by node: typing in one of 5,000 blocks
    // mustn't allocate per block.
    let headSize = 0;
    for (let i = 0; i < head; i++) headSize += before[i]?.length ?? 0;
    // Old children whose start survived, by where it went; those of replaced
    // ranges by identity, for a node moved within this plot, and the leaves
    // among them by where a retag put them.
    type Old = { key: string; node: Node; start: number };
    const found = new Map<number, Old>();
    const byNode = new Map<Node, Old[]>();
    const retagged = new Map<number, Old>();
    for (let i = head, pos = oldStart + headSize; i < oldTail; i++) {
      const node = before[i];
      if (!node) continue;
      const key = oldKeys[i];
      if (key && !node.isText) {
        const old = { key, node, start: pos };
        const mapped = mapNodePos(changes, pos, node.isLeaf);
        if (mapped && !mapped.retagged) found.set(mapped.pos, old);
        else {
          byNode.set(node, [...(byNode.get(node) ?? []), old]);
          if (mapped) retagged.set(mapped.pos, old);
        }
      }
      pos += node.length;
    }
    // Each old key goes once: to its node where it's still there (moved),
    // else to what a retag put in its place, if of its type.
    const claimed = new Set<Old>();
    const moved: (Old | undefined)[] = [];
    for (let i = head; i < newTail; i++) {
      const child = after[i];
      const old =
        child && !child.isText ? byNode.get(child)?.find((old) => !claimed.has(old)) : undefined;
      if (old) claimed.add(old);
      moved.push(old);
    }
    const same = (child: Node, key: string | undefined) => {
      if (key !== undefined) return key;
      if (child.isPlot) addFreshKeys(keys, child);
      return child.isText ? "" : createNodeKey();
    };
    const newKeys: string[] = [];
    for (let i = 0; i < head; i++) {
      const child = after[i];
      if (child) newKeys.push(same(child, oldKeys[i]));
    }
    for (let i = head, pos = newStart + headSize; i < newTail; i++) {
      const child = after[i];
      if (!child) continue;
      const start = pos;
      pos += child.length;
      if (child.isText) {
        newKeys.push("");
        continue;
      }
      let kept = found.get(start) ?? moved[i - head];
      const retag = kept ? undefined : retagged.get(start);
      if (retag && !claimed.has(retag) && retag.node.type == child.type) {
        claimed.add(retag);
        kept = retag;
      }
      // A moved plot is the same object: its content keeps its keys.
      if (child.isPlot && kept?.node.isPlot && kept.node != child)
        mapChildren(kept.node, kept.start + 1, child, start + 1);
      else if (child.isPlot) addFreshKeys(keys, child);
      newKeys.push(kept ? kept.key : createNodeKey());
    }
    for (let i = newTail; i < after.length; i++) {
      const child = after[i];
      if (child) newKeys.push(same(child, oldKeys[i - newTail + oldTail]));
    }
    keys.set(newPlot, newKeys);
  };
  mapChildren(oldDoc, 0, newDoc, 0);
  return replaced;
};

const typeIds = new WeakMap<Widget.Type<unknown>, number>();
let lastTypeId = 0;

const typeId = (type: Widget.Type<unknown>) => {
  let id = typeIds.get(type);
  if (id === undefined) typeIds.set(type, (id = ++lastTypeId));
  return id;
};

// The keys of a list of sibling views (ChildNodeViews renders them, ReactDocTile
// records them), paired with them. A node's key comes from ReactKeys, through
// its view (iterDeco); other
// views are keyed after their previous sibling, so a text run keeps its text
// node while its start changes. Widgets don't count as that sibling: one
// coming or going leaves the next text node alone. React point widgets come
// with keys (iterDeco); other widgets are keyed after the sibling on their
// side (the next one for a positive side, as a `before` widget sticks to its
// node) and their type, so a React tag widget keeps its instance while its
// node does.
// A composition, and the wrappers around it, keep the keys of the nodes React
// committed there, and nothing else in their list may take those.
export const childViewKeys = (views: readonly ChildView[]) => {
  const fixed = (view: ChildView) =>
    view.type == "composition" || view.type == "wrapper" ? view.key : undefined;
  const taken = new Set<string>();
  for (const view of views) {
    const key = fixed(view);
    if (key !== undefined) taken.add(key);
  }
  let previous = "";
  let widgets = false;
  // Widgets first get the key before them, and their own key below.
  const keyed = views.map((view) => {
    if (view.type == "widget") {
      if (view.key !== undefined) return { view, key: view.key };
      widgets = true;
      return { view, key: previous };
    }
    let key = fixed(view);
    if (key === undefined) {
      key =
        view.type == "node"
          ? view.key
          : `${previous}>${view.type == "buffer" ? `buffer${view.side}` : view.type}`;
      while (taken.has(key)) key += "+";
    }
    previous = key;
    return { view, key };
  });
  if (!widgets) return keyed;
  let next = "";
  const used = new Set<string>();
  for (let i = keyed.length - 1; i >= 0; i--) {
    const entry = keyed[i];
    if (!entry) continue;
    const { view } = entry;
    if (view.type != "widget") {
      next = entry.key;
      continue;
    }
    if (view.key !== undefined) continue;
    const id = typeId(view.widget.type);
    let key = view.side > 0 ? `${next}<w${id}` : `${entry.key}>w${id}`;
    while (used.has(key)) key += "+";
    used.add(key);
    entry.key = key;
  }
  return keyed;
};
