// Adapted from vue-wordgard's ContentContext.ts (WrappedKey) for Svelte: what a node wrapper's
// WrappedNode reports to the node it wraps.
import { getContext } from "svelte";

export type WrappedContextValue = {
  // Called once, as the WrappedNode is set up: the contexts the node gets,
  // and its attributes, read when the node is drawn.
  readonly wrap: (
    contexts: Map<unknown, unknown>,
    attributes: () => Record<string, unknown>
  ) => void;
  // Its attributes changed.
  readonly changed: () => void;
};

export const WrappedKey = Symbol("wrapped");

export const useWrappedContext = () => {
  const wrapped = getContext<WrappedContextValue | null | undefined>(WrappedKey);
  if (!wrapped)
    throw new Error("WrappedNode is what a Svelte node wrapper wraps: use it in its component");
  return wrapped;
};
