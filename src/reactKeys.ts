// Named after react-prosemirror's reactKeys plugin, rewritten for Wordgard: no
// plugin, since Wordgard hands the view its changes. Keys are kept per parent
// plot, by child index, so rendering needs no positions and a plot that
// keeps its identity keeps its keys without any work.
import type { Node, Plot } from "wordgard/doc";
import type { Widget } from "wordgard/editor";

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

// Wordgard's ChangeSet.mapPos with assoc 1 and track "after", over a sections
// array: where the node starting at `pos` went, or null when its first token
// was replaced. `retagged` marks a replacement of that token alone, by one
// token (a tag or parameter change), which keeps the key when the node type
// stays the same. A copy, since `update` gets bare sections and Wordgard can't
// map over those (docs/wordgard-upstream-bugs.md, "Requests").
const mapNodePos = (changes: readonly number[], pos: number) => {
  let posA = 0;
  let posB = 0;
  for (let i = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    const endA = posA + len;
    if (ins < 0) {
      if (endA > pos) return { pos: posB + pos - posA, retagged: false };
      posB += len;
    } else {
      if (endA > pos)
        return posA == pos && len == 1 && ins == 1 ? { pos: posB, retagged: true } : null;
      posB += ins;
    }
    posA = endA;
  }
  return { pos: posB + pos - posA, retagged: false };
};

// Carries keys from `oldDoc` to `newDoc` through `changes` (the sections
// DocTile.update receives), as react-prosemirror maps them through a
// transaction's steps: a node whose start survives keeps its key, others get
// fresh ones. Only plots that changed identity are visited. Returns, for each
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
    const found = new Map<number, { key: string; node: Node; start: number; retagged: boolean }>();
    let pos = oldStart;
    oldPlot.content.forEach((node, i) => {
      const mapped = node.isText ? null : mapNodePos(changes, pos);
      const key = oldKeys[i];
      if (mapped && key)
        found.set(mapped.pos, { key, node, start: pos, retagged: mapped.retagged });
      pos += node.length;
    });
    pos = newStart;
    const newKeys = newPlot.content.map((child) => {
      const start = pos;
      pos += child.length;
      if (child.isText) return "";
      const old = found.get(start);
      const kept = old && (!old.retagged || old.node.type == child.type) ? old : undefined;
      if (child.isPlot) {
        if (kept?.node.isPlot) mapChildren(kept.node, kept.start + 1, child, start + 1);
        else addFreshKeys(keys, child);
      }
      return kept ? kept.key : createNodeKey();
    });
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
// records them), paired with them. A node's key comes from ReactKeys; other
// views are keyed after their previous sibling, so a text run keeps its text
// node while its start changes. Widgets don't count as that sibling: one
// coming or going leaves the next text node alone. React point widgets come
// with keys (iterDeco); other widgets are keyed after the sibling on their
// side (the next one for a positive side, as a `before` widget sticks to its
// node) and their type, so a React tag widget keeps its instance while its
// node does.
// A composition, and the wrappers around it, keep the keys of the nodes React
// committed there, and nothing else in their list may take those.
export const childViewKeys = (views: readonly ChildView[], nodeKeys: readonly string[]) => {
  const fixed = (view: ChildView) =>
    view.type == "composition" || view.type == "wrapper" ? view.key : undefined;
  const taken = new Set(views.map(fixed));
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
          ? nodeKeys[view.index]
          : `${previous}>${view.type == "buffer" ? `buffer${view.side}` : view.type}`;
      if (key === undefined) throw new Error("No key for a node");
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
