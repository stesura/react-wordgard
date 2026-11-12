// Not in react-prosemirror, whose DOM specs give attributes as objects. What reading Wordgard's
// `Elt`s takes, without React.
import type { Attributes } from "wordgard/doc";

// Wordgard's attributes are a flat [name, value, ...] array.
export const attrsToRecord = (attrs: Attributes) => {
  const record: Record<string, string> = {};
  for (let i = 0; i + 1 < attrs.length; i += 2) {
    const name = attrs[i];
    const value = attrs[i + 1];
    if (name !== undefined && value !== undefined) record[name] = value;
  }
  return record;
};

export const namespaced = /^(svg|math):/;

// An Elt's tag as the DOM names it: Wordgard's `svg:path` is a `path` element,
// its namespace coming from the <svg> or <math> around it.
export const localTagName = (tagName: string) => tagName.replace(namespaced, "");
