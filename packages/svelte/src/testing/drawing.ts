// For the teardown tests: what a document's drawing still holds (the node parts drawn, each
// listening to its cell, and the holder's anchors).
import { drawings } from "../SvelteDocTile.js";

export const drawingOf = (dom: Element) => {
  const found = drawings.get(dom);
  if (!found) throw new Error("Not drawn by svelte-wordgard");
  const { nodes, holder } = found();
  return { nodes: [...nodes], mounted: holder.mounted(), holder: holder.element };
};
