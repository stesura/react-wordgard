// Adapted from react-wordgard's helpers/props.ts for Vue: Wordgard's attributes as Vue props.
// Vue sets some props as DOM properties (`src`, `width`, `hidden`); a `^` before the name makes it
// set the attribute, as Wordgard's own setAttribute does.
import type { Attributes } from "wordgard/doc";

export const eltProps = (attrs: Attributes) => {
  const props: Record<string, string> = {};
  for (let i = 0; i + 1 < attrs.length; i += 2) {
    const name = attrs[i];
    const value = attrs[i + 1];
    if (name !== undefined && value !== undefined) props[`^${name}`] = value;
  }
  return props;
};
