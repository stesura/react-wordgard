import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { DocTile } from "./wordgardInternals.js";

// For now Wordgard still builds the tiles; this class only makes every update
// go through our code. Step 3 builds the tree from React instead.
export class ReactDocTile extends DocTile {
  static create = (state: GardState, dom: Element, wg: Wordgard) =>
    ReactDocTile.adopt(DocTile.create(state, dom, wg));

  // Wordgard's updates return its own DocTile; take over its children.
  static adopt = (tile: DocTile): ReactDocTile => {
    if (tile instanceof ReactDocTile) return tile;
    const adopted = new ReactDocTile(tile.state, tile.dom, tile.cursorWrapper, tile.decoSet);
    adopted.children = tile.children;
    for (const child of adopted.children) child.parent = adopted;
    adopted.length = tile.length;
    adopted.flags = tile.flags;
    return adopted;
  };

  update(state: GardState, changes: readonly number[], wg: Wordgard, composition?: unknown) {
    return ReactDocTile.adopt(super.update(state, changes, wg, composition));
  }
}
