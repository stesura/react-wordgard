// Not in react-prosemirror: a state field read through the store's per-field subscriptions
// (EditorContext), where a selector runs on every flush.
import { useCallback } from "react";
import { useSyncExternalStoreWithSelector } from "use-sync-external-store/with-selector";

import { type StateField, useEditorContext } from "../contexts/EditorContext.js";

const identity = <T>(value: T) => value;

// Overloads: without `select` the result is the field's value, which an arrow can't type
// without a cast.
/**
 * A state field's value as of the last flush, or a part of it through `select`. Nothing runs on a
 * flush that leaves the field unchanged. The field must be in the editor's configuration.
 */
export function useEditorField<T>(field: StateField<T>): T;
export function useEditorField<T, Result>(
  field: StateField<T>,
  select: (value: T) => Result,
  isEqual?: (a: Result, b: Result) => boolean
): Result;
export function useEditorField<T, Result>(
  field: StateField<T>,
  select?: (value: T) => Result,
  isEqual?: (a: T | Result, b: T | Result) => boolean
): T | Result {
  const { store } = useEditorContext();
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeField(field, listener),
    [store, field]
  );
  const get = useCallback(() => store.getState().field(field), [store, field]);
  return useSyncExternalStoreWithSelector<T, T | Result>(
    subscribe,
    get,
    get,
    select ?? identity,
    isEqual
  );
}

/**
 * The entry `key` of a field whose value is a `Map` (per-node data keyed by id), as of the last
 * flush: the component re-renders only when that entry changes (`===`), not on the map's other
 * entries.
 */
export const useEditorFieldEntry = <K, V>(
  field: StateField<ReadonlyMap<K, V>>,
  key: K
): V | undefined => {
  const { store } = useEditorContext();
  const subscribe = useCallback(
    (listener: () => void) => store.subscribeField(field, listener, key),
    [store, field, key]
  );
  const get = useCallback(() => store.getState().field(field).get(key), [store, field, key]);
  return useSyncExternalStoreWithSelector(subscribe, get, get, identity);
};
