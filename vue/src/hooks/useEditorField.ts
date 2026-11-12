// Adapted from react-wordgard's useEditorField for Vue: a `computed` over the store's per-field
// subscriptions, which keeps its last value while `isEqual` says so.
import { type ComputedRef, computed, onUnmounted, shallowRef } from "vue";

import type { StateField } from "../../../src/editorStore.js";
import { useEditorContext } from "../contexts/EditorContext.js";
import { onPublish, updateInFlush } from "../sync.js";

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
  const editor = useEditorContext("useEditorField");
  const { store } = editor;
  // Bumped when the field changes; reading it makes the computed depend on it.
  const version = shallowRef(0);
  onUnmounted(
    store.subscribeField(
      field,
      onPublish(editor, () => {
        version.value++;
      })
    )
  );
  updateInFlush();
  return computed<T | Result>((previous) => {
    void version.value;
    const value = store.getState().field(field);
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
  const editor = useEditorContext("useEditorFieldEntry");
  const { store } = editor;
  const version = shallowRef(0);
  onUnmounted(
    store.subscribeField(
      field,
      onPublish(editor, () => {
        version.value++;
      }),
      key
    )
  );
  updateInFlush();
  return computed(() => {
    void version.value;
    return store.getState().field(field).get(key);
  });
};
