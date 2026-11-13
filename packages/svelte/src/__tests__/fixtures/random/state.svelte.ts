// A random test component's own state: `defaults`, or what `pending` gives the next of its kind.
import { onDestroy } from "svelte";
import type { Wordgard } from "wordgard/editor";

import { type State, enroll, pending } from "./mounted.js";

export const join = <T extends State>(
  wg: Wordgard,
  kind: string,
  at: () => number,
  defaults: T
) => {
  const claim = pending.get(kind)?.shift();
  const state = $state(Object.assign({}, defaults, claim?.state));
  onDestroy(enroll(wg, { kind, at, state, expected: claim?.at }));
  return state;
};
