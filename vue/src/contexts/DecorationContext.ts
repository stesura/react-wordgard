// Adapted from react-wordgard's DecorationContext.ts and DecorationRootContext.ts for Vue: the
// Vue decoration a component is drawn in, for the decoration composables, and its root's tag, for
// DecorationRoot. Wordgard's attributes reach the root by falling through, not from here.
import { type InjectionKey, type Ref, inject } from "vue";

import type { DecorationHandlers } from "../../../src/decorations/decorationHandlers.js";

export type DecorationContextValue = {
  readonly handlers: DecorationHandlers;
  readonly selected: Readonly<Ref<boolean>>;
};

// Null below what isn't a decoration (a node wrapper), so a component there
// doesn't take the one around it for its own.
export const DecorationKey: InjectionKey<DecorationContextValue | null> = Symbol("decoration");

export const DecorationRootKey: InjectionKey<{ readonly tagName: () => string } | null> =
  Symbol("decorationRoot");

export const useDecorationContext = (composable: string) => {
  const context = inject(DecorationKey, null);
  if (!context)
    throw new Error(`${composable} is called outside a Vue shape, wrapper, mark or widget`);
  return context;
};
