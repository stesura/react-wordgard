// What the test components start with, and their controls, by editor, in the order they mount.
import { getContext } from "svelte";
import type { Wordgard } from "wordgard/editor";

export const initial: {
  bar: boolean;
  deep: boolean;
  header: boolean;
  fail: boolean;
  key: number;
  lead: string | null;
} = { bar: true, deep: false, header: true, fail: false, key: 0, lead: "1" };

export type Control = {
  set: (name: string, value: unknown) => void;
  getPos: () => number;
};

export const controls = new Map<Wordgard, Control[]>();

export const register = (wg: Wordgard, control: Control) =>
  controls.set(wg, [...(controls.get(wg) ?? []), control]);

// Components alive, by name.
export const alive = new Map<string, number>();

export const live = (name: string, by: number) => alive.set(name, (alive.get(name) ?? 0) + by);

// What a node wrapper hands the components below it: a lead.
export const Lead = Symbol("lead");

export type LeadValue = { readonly current: string | null };

export const useLead = () => getContext<LeadValue | undefined>(Lead) ?? { current: null };

export const reset = () => {
  Object.assign(initial, {
    bar: true,
    deep: false,
    header: true,
    fail: false,
    key: 0,
    lead: "1",
  });
  controls.clear();
  alive.clear();
};
