// Split from ReactWrapperType.ts, without React: a wrapper a component draws is a real Wordgard
// `Elt` with a hole, registered as shapes are (the reserved attribute).
import { Elt } from "wordgard/doc";

import { idOf, reserved } from "./shapeType.js";

// Keyed apart from shapes' ids, which share the attribute.
const wrapperIds = new Set<string>();

// A new wrapper: its id, which its component is registered under, and its
// `Elt` for each root element.
export const defineWrapper = () => {
  const id = `w${wrapperIds.size + 1}`;
  wrapperIds.add(id);
  const elts = new Map<string, Elt>();
  const elt = (element: string) => {
    let found = elts.get(element);
    if (!found) {
      found = Elt.mk(element, { [reserved]: id }, [0]);
      elts.set(element, found);
    }
    return found;
  };
  return { id, elt };
};

export const isComponentWrapper = (elt: Elt<unknown>) => {
  const id = idOf(elt);
  return id != null && wrapperIds.has(id);
};
