// What this folder's components start with, beside controls.ts's `initial`, what they count, and
// their controls by editor and kind, in the order they mount.
import type { Wordgard } from "wordgard/editor";

import type { Control } from "../controls.js";

export const start = { exact: false, open: false, first: false };

export const counted = { chipMounts: 0 };

const kinds = new Map<Wordgard, Map<string, Control[]>>();

export const enlist = (wg: Wordgard, kind: string, control: Control) => {
  const byKind = kinds.get(wg) ?? new Map<string, Control[]>();
  byKind.set(kind, [...(byKind.get(kind) ?? []), control]);
  kinds.set(wg, byKind);
};

export const enlisted = (wg: Wordgard, kind: string) => kinds.get(wg)?.get(kind) ?? [];

// What a row tells its cells, and a paragraph its line number widget.
export const Exact = Symbol("exact");
export const Line = Symbol("line");

export type Current<T> = { readonly current: T };

export const resetShape = () => {
  Object.assign(start, { exact: false, open: false, first: false });
  counted.chipMounts = 0;
  kinds.clear();
};
