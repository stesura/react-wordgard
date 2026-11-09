import { useMemo } from "react";
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

// Kept while its values are: a node's shape is a new Elt whenever anything in the node changed, and
// a new record makes its DecorationRootContext a new value, whose readers React looks for through
// everything the node holds (a section's: every paragraph's DecorationRoot, on every key).
export const useAttrsRecord = (attrs: Attributes): Record<string, string> => {
  const key = JSON.stringify(attrs);
  return useMemo(() => attrsToRecord(parseAttrs(key)), [key]);
};

const parseAttrs = (key: string): Attributes => {
  const parsed: unknown = JSON.parse(key);
  return Array.isArray(parsed) && parsed.every((value): value is string => typeof value == "string")
    ? parsed
    : [];
};
