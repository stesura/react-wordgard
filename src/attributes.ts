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
