// The random test's components by editor, and what a fresh editor's start with, by kind, in the
// order they mount.
import type { Wordgard } from "wordgard/editor";

export type State = Record<string, boolean | string | number>;

export type Mounted = {
  kind: string;
  // Where it is: its node's or mark's position, or a widget's index.
  at: () => number;
  state: State;
  // Where `pending` said it would be, in a fresh editor.
  expected?: number;
};

export const mounted = new Map<Wordgard, Set<Mounted>>();

export const pending = new Map<string, { at: number; state: State }[]>();

export const enroll = (wg: Wordgard, entry: Mounted) => {
  mounted.set(wg, (mounted.get(wg) ?? new Set()).add(entry));
  return () => mounted.get(wg)?.delete(entry);
};
