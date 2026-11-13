// Adapted from react-wordgard's useEditorField (by way of vue-wordgard's) for Svelte: a `$derived`
// over the store's per-field subscriptions, which keeps its last value while `isEqual` says so.
import { onDestroy } from "svelte";

import type { StateField } from "@stesura/wordgard-view";
import { useEditorContext } from "../contexts/EditorContext.js";
import { onPublish } from "../helpers/publish.js";

// Overloads: without `select` the result is the field's value, which an arrow can't type
// without a cast.
/**
 * A state field's value as of the editor's last update, or a part of it through `select`, in
 * `current`. Nothing runs on an update that leaves the field unchanged. The field must be in the
 * editor's configuration.
 */
export function useEditorField<T>(field: StateField<T>): { readonly current: T };
export function useEditorField<T, Result>(
  field: StateField<T>,
  select: (value: T) => Result,
  isEqual?: (a: Result, b: Result) => boolean
): { readonly current: Result };
export function useEditorField<T, Result>(
  field: StateField<T>,
  select?: (value: T) => Result,
  isEqual?: (a: T | Result, b: T | Result) => boolean
): { readonly current: T | Result } {
  const editor = useEditorContext("useEditorField");
  const { store } = editor;
  // Bumped when the field changes; reading it makes the value depend on it.
  let version = $state(0);
  onDestroy(
    store.subscribeField(
      field,
      onPublish(editor, () => {
        version++;
      })
    )
  );
  let last: { value: T | Result } | null = null;
  const value = $derived.by(() => {
    void version;
    const found = store.getState().field(field);
    const next = select ? select(found) : found;
    if (last && isEqual?.(last.value, next)) return last.value;
    last = { value: next };
    return next;
  });
  return {
    get current() {
      return value;
    },
  };
}

/**
 * The entry `key` of a field whose value is a `Map` (per-node data keyed by id), as of the editor's
 * last update, in `current`: it changes only when that entry changes (`===`), not on the map's
 * other entries.
 */
export const useEditorFieldEntry = <K, V>(
  field: StateField<ReadonlyMap<K, V>>,
  key: K
): { readonly current: V | undefined } => {
  const editor = useEditorContext("useEditorFieldEntry");
  const { store } = editor;
  let version = $state(0);
  onDestroy(
    store.subscribeField(
      field,
      onPublish(editor, () => {
        version++;
      }),
      key
    )
  );
  const value = $derived.by(() => {
    void version;
    return store.getState().field(field).get(key);
  });
  return {
    get current() {
      return value;
    },
  };
};
