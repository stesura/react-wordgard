// Named after our react-prosemirror fork's RenderStoreContext, rewritten for
// Wordgard: what the view computes for rendering, held in one object per
// content element and provided once, so its context value never changes and
// memoised node views are never scanned for it. ReactDocTile writes it inside
// Wordgard's flush, before React renders. No subscriptions until something
// needs to re-render without its props changing.
import { createContext, useContext } from "react";
import type { Wordgard } from "wordgard/editor";

import type { ReactKeys } from "../reactKeys.js";

export type RenderStore = {
  readonly keys: ReactKeys;
  readonly wg: Wordgard;
};

export const RenderStoreContext = createContext<RenderStore | null>(null);

export const useRenderStore = () => {
  const store = useContext(RenderStoreContext);
  if (!store) throw new Error("Rendered outside a ReactDocTile");
  return store;
};
