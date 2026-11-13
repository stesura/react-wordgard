// Not in react-prosemirror: a decoration's root its component replaced (React: another element or
// key from its own state; Svelte: a block at its top switching, an HMR update). Outside the flush,
// the tiles are still over the old root until they're rebuilt over the new one (tile.ts,
// `rebuildRoots`), and the records of the swap aren't edits.

// A new root, and the root its tiles are over.
const tiledRoots = new WeakMap<Element, Element>();
// A root with tiles, and the one that replaced it last.
const replacements = new WeakMap<Element, Element>();

// Records that `root` replaced `old`. Only a root that has tiles, or replaced
// one that has, counts: one drawn in the flush is built there.
export const rootReplaced = (old: Element, root: Element) => {
  if (old == root) return;
  const tiled = old.wgTile ? old : tiledRoots.get(old);
  if (!tiled) return;
  tiledRoots.set(root, tiled);
  replacements.set(tiled, root);
};

// The root a tile over `dom` is to be built over now.
export const currentRoot = (dom: Element) => replacements.get(dom) ?? dom;

// The root the tiles of `root` are over: itself once they're rebuilt.
export const tiledRoot = (root: Element) => (root.wgTile ? root : (tiledRoots.get(root) ?? root));

const isReplaced = (node: Node) => {
  if (!(node instanceof Element)) return false;
  const latest = replacements.get(tiledRoot(node));
  return !!latest && latest != node;
};

// A DOM record of roots swapped: only replaced roots removed, only their
// replacements added.
export const swapsRoots = (record: MutationRecord) =>
  record.type == "childList" &&
  record.addedNodes.length + record.removedNodes.length > 0 &&
  // Not one rebuilt since, moved later.
  [...record.addedNodes].every(
    (node) => node instanceof Element && tiledRoots.has(node) && !node.wgTile
  ) &&
  [...record.removedNodes].every(isReplaced);
