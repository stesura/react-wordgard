// Split from EditorContext.ts (named after react-prosemirror's EditorContext, rewritten for
// Wordgard), without React: the editor's store, effects and measures. One value per editor, which
// never changes, so memoised components aren't scanned for it.
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

export type StateField<T> = GardState.Field<T> | GardState.Field.Derived<T>;

export type EditorStore = {
  // The state the DOM shows: published inside the flush, in the same React
  // commit as the document.
  readonly getState: () => GardState;
  readonly subscribe: (listener: () => void) => () => void;
  // Called when the published value of `field` changes or, given `key`, that entry of its map.
  readonly subscribeField: (
    field: StateField<unknown>,
    listener: () => void,
    key?: unknown
  ) => () => void;
};

const NONE = Symbol("none");

// A field the state lacks (a reconfiguration added or removed it) reads as
// NONE: its subscribers are told, and the hook reading it throws.
const read = (state: GardState, field: StateField<unknown>): unknown => {
  try {
    return state.field(field);
  } catch {
    return NONE;
  }
};

// A value that isn't a Map compares whole: its entries' subscribers are told of any change.
const entryOf = (value: unknown, key: unknown): unknown =>
  value instanceof Map ? value.get(key) : value;

type FieldListeners = {
  readonly all: Set<() => void>;
  readonly keys: Map<unknown, Set<() => void>>;
};

// One comparison per subscribed field per publish; entries only when the map changed.
const notifyFields = (
  fields: Map<StateField<unknown>, FieldListeners>,
  before: GardState,
  after: GardState
) => {
  const pending: (() => void)[] = [];
  for (const [field, { all, keys }] of fields) {
    const a = read(before, field);
    const b = read(after, field);
    if (a === b) continue;
    pending.push(...all);
    for (const [key, listeners] of keys) {
      if (entryOf(a, key) !== entryOf(b, key)) pending.push(...listeners);
    }
  }
  for (const listener of pending) listener();
};

// Reads in the flush's read phase, returning the write for its write phase, or
// null for none.
export type Measure = () => (() => void) | null;

export type EditorValue = {
  readonly wg: Wordgard;
  readonly store: EditorStore;
  // Runs `effect` once the editor's DOM is up to date: after the flush under
  // way or pending, or, when there's none, in a microtask, out of React's
  // commit (a flush from inside it couldn't render), before the paint.
  readonly afterFlush: (effect: () => void) => void;
  readonly cancel: (effect: () => void) => void;
  readonly measures: Set<Measure>;
  // Schedules the measures in the editor's next read phase.
  readonly requestMeasure: () => void;
};

// What the bridge drives: the doc tile publishes and schedules the measures,
// ReactWordgard marks its flush and runs the effects after it, WordgardDoc
// asks for them once the editor is in the page. `batch`, its renderer's (set
// with the doc tile), runs a change and commits what components draw from it.
type Editor = EditorValue & {
  readonly publish: (state: GardState) => void;
  readonly readMeasures: (wg: Wordgard) => void;
  readonly runEffects: () => void;
  readonly requestEffects: () => void;
  flushing: boolean;
  batch: (change: () => void) => void;
};

const editors = new WeakMap<Wordgard, Editor>();

export const editorOf = (wg: Wordgard): Editor => {
  const found = editors.get(wg);
  if (found) return found;
  let state = wg.state;
  const listeners = new Set<() => void>();
  const fields = new Map<StateField<unknown>, FieldListeners>();
  const effects = new Set<() => void>();
  const measures = new Set<Measure>();
  let requested = false;
  // After a flush the DOM shows `state`, even when a dispatch since then
  // (an update listener's) has put `wg.state` ahead.
  const runEffects = () => {
    if (!wg.connected) return;
    const pending = [...effects];
    effects.clear();
    for (const effect of pending) effect();
  };
  // Without a flush under way or pending, the DOM is up to date.
  const requestEffects = () => {
    if (requested) return;
    requested = true;
    queueMicrotask(() => {
      requested = false;
      if (!editor.flushing && wg.state == state) runEffects();
    });
  };
  const readMeasures = (wg: Wordgard) => {
    const writes = [...measures].flatMap((measure) => measure() ?? []);
    // A scheduled write makes Wordgard measure again.
    if (!writes.length) return;
    // Component state set by a write commits now, on the same paint.
    wg.scheduleDOMWrite(() =>
      editor.batch(() => {
        for (const write of writes) write();
      })
    );
  };
  const editor: Editor = {
    wg,
    store: {
      getState: () => state,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      subscribeField: (field, listener, key) => {
        let found = fields.get(field);
        if (!found) fields.set(field, (found = { all: new Set(), keys: new Map() }));
        const { all, keys } = found;
        const set = key === undefined ? all : (keys.get(key) ?? new Set<() => void>());
        if (key !== undefined) keys.set(key, set);
        set.add(listener);
        return () => {
          set.delete(listener);
          if (key !== undefined && !set.size) keys.delete(key);
          if (!all.size && !keys.size) fields.delete(field);
        };
      },
    },
    afterFlush: (effect) => {
      effects.add(effect);
      if (!editor.flushing) requestEffects();
    },
    cancel: (effect) => effects.delete(effect),
    measures,
    requestMeasure: () => wg.scheduleDOMRead(readMeasures),
    publish: (next) => {
      if (next == state) return;
      const before = state;
      state = next;
      for (const listener of listeners) listener();
      if (fields.size) notifyFields(fields, before, next);
    },
    readMeasures,
    runEffects,
    requestEffects,
    flushing: false,
    batch: (change) => change(),
  };
  editors.set(wg, editor);
  return editor;
};

// The editor's value when react-wordgard drives it (WordgardEditor made it).
export const findEditor = (wg: Wordgard): EditorValue | undefined => editors.get(wg);
