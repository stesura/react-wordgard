// Not in react-prosemirror, whose node views draw their root: Wordgard fixes the root's tag before
// React draws.
import { createContext } from "react";

export type DecorationRootValue = {
  tagName: string;
  // Wordgard's attributes, by name.
  attrs: Record<string, string>;
  ref: (dom: Element | null) => void;
};

export const DecorationRootContext = createContext<DecorationRootValue | null>(null);
