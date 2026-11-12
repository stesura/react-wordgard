// What the test components start with, and their controls, by editor, in the order they mount.
import type { Wordgard } from "wordgard/editor";

export const initial = { bar: true, deep: false, header: true, fail: false };

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

export const reset = () => {
  Object.assign(initial, { bar: true, deep: false, header: true, fail: false });
  controls.clear();
  alive.clear();
};
