// What the hosting tests' components report, and what the tests set for them.
import type { Wordgard } from "wordgard/editor";

import { box } from "../../../helpers/box.svelte.js";

// The editors the Grab components are drawn under, last mounted last.
export const grabbed: Wordgard[] = [];

// What the components logged, by name, in order.
export const logged: Record<string, unknown[]> = {};

export const log = (name: string, value: unknown) => {
  (logged[name] ??= []).push(value);
};

export const logOf = (name: string) => logged[name] ?? [];

// Whether Host draws its `toggled` component.
export const toggle = box(false);

// Set by the tests to update the components reading it.
export const bump = box(0);

export const resetProbes = () => {
  grabbed.length = 0;
  for (const name of Object.keys(logged)) delete logged[name];
  toggle.current = false;
  bump.current = 0;
};
