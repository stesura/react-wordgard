// Adapted from react-wordgard's useEditorField for Vue: a `computed` over the store's per-field
// subscriptions, which keeps its last value while `isEqual` says so.
import { type ComputedRef, computed, shallowRef } from "vue";

import type { StateField } from "@stesura/wordgard-view";
import { currentEditor, followEditor, useEditorSource } from "../contexts/EditorContext.js";
import { publisher, updateInFlush } from "../sync.js";

// Bumped when the field changes; the computed reads it, and the editor's source, which a
// WordgardScope changes.
const useFieldVersion = (composable: string, field: StateField<unknown>, key?: unknown) => {
  const source = useEditorSource(composable);
  const subscribe = publisher();
  const version = shallowRef(0);
  followEditor(source, (editor) =>
    subscribe(
      editor,
      (listener) => editor.store.subscribeField(field, listener, key),
      () => {
        version.value++;
      }
    )
  );
  updateInFlush();
  return () => {
    void version.value;
    return currentEditor(source).store.getState();
  };
};

// Overloads: without `select` the result is the field's value, which an arrow can't type
// without a cast.
/**
 * A state field's value as of the editor's last update, or a part of it through `select`. Nothing
 * runs on an update that leaves the field unchanged. The field must be in the editor's
 * configuration.
 */
export function useEditorField<T>(field: StateField<T>): Readonly<ComputedRef<T>>;
export function useEditorField<T, Result>(
  field: StateField<T>,
  select: (value: T) => Result,
  isEqual?: (a: Result, b: Result) => boolean
): Readonly<ComputedRef<Result>>;
export function useEditorField<T, Result>(
  field: StateField<T>,
  select?: (value: T) => Result,
  isEqual?: (a: T | Result, b: T | Result) => boolean
): Readonly<ComputedRef<T | Result>> {
  const state = useFieldVersion("useEditorField", field);
  return computed<T | Result>((previous) => {
    const value = state().field(field);
    const next = select ? select(value) : value;
    return previous !== undefined && isEqual?.(previous, next) ? previous : next;
  });
}

/**
 * The entry `key` of a field whose value is a `Map` (per-node data keyed by id), as of the editor's
 * last update: the component renders again only when that entry changes (`===`), not on the map's
 * other entries.
 */
export const useEditorFieldEntry = <K, V>(
  field: StateField<ReadonlyMap<K, V>>,
  key: K
): Readonly<ComputedRef<V | undefined>> => {
  const state = useFieldVersion("useEditorFieldEntry", field, key);
  return computed(() => state().field(field).get(key));
};
