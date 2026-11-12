// Adapted from react-wordgard's DecorationContext.ts and DecorationRootContext.ts (by way of
// vue-wordgard's) for Svelte: the Svelte decoration a component is drawn in, for the decoration
// functions, and its root's tag, for DecorationRoot.
import { getContext } from "svelte";

import type { DecorationHandlers } from "@stesura/wordgard-view";

export type DecorationContextValue = {
  readonly handlers: DecorationHandlers;
  // Whether it draws the node selection, read reactively.
  readonly selected: { readonly current: boolean };
  // Its root's tag, read reactively.
  readonly tagName: { readonly current: string };
};

export const DecorationKey = Symbol("decoration");

export const decorationContext = () =>
  getContext<DecorationContextValue | null | undefined>(DecorationKey) ?? null;

export const useDecorationContext = (composable: string) => {
  const context = decorationContext();
  if (!context)
    throw new Error(`${composable} is called outside a Svelte shape, wrapper, mark or widget`);
  return context;
};
