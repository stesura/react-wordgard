// The React decoration a component is drawn in, for the decoration hooks. Replaces
// react-prosemirror's GetPosContext and SelectNodeContext; the handlers are in
// decorations/decorationHandlers.ts.
import { createContext, useContext } from "react";

import type { DecorationHandlers } from "@stesura/wordgard-view";

export type DecorationContextValue = {
  readonly handlers: DecorationHandlers;
  readonly selected: boolean;
};

export const DecorationContext = createContext<DecorationContextValue | null>(null);

export const useDecorationContext = (hook: string) => {
  const context = useContext(DecorationContext);
  if (!context) throw new Error(`${hook} is called outside a React shape, wrapper, mark or widget`);
  return context;
};
