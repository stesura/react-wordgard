// What the mark, DecorationRoot and accessibility tests' components start with, their links'
// controls by editor (in the order they mount), and what they count.
import type { Mark } from "wordgard/doc";
import type { Wordgard } from "wordgard/editor";

export const initial = { icon: true, boxed: false };

export type LinkControl = {
  set: (name: string, value: unknown) => void;
  getPos: () => number;
  mark: () => Mark;
};

export const links = new Map<Wordgard, LinkControl[]>();

export const registerLink = (wg: Wordgard, control: LinkControl) =>
  links.set(wg, [...(links.get(wg) ?? []), control]);

// Widget renders and mounts.
export const counts = { draws: 0, badges: 0 };

export const resetMarks = () => {
  Object.assign(initial, { icon: true, boxed: false });
  Object.assign(counts, { draws: 0, badges: 0 });
  links.clear();
};
