// Named after react-prosemirror's EditorContext, rewritten for Wordgard: the
// editor, the state as of its last flush (react-prosemirror's state store),
// and what the hooks register to run around its flush. One value per editor,
// which never changes, so memoised components aren't scanned for it.
import { createContext, useContext } from "react";
import { flushSync } from "react-dom";
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

export type EditorStore = {
  // The state the DOM shows: published inside the flush, in the same React
  // commit as the document.
  readonly getState: () => GardState;
  readonly subscribe: (listener: () => void) => () => void;
};

// Reads in the flush's read phase, returning the write for its write phase.
export type Measure = () => () => void;

export type EditorContextValue = {
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

// What the bridge drives: ReactDocTile publishes and schedules the measures,
// ReactWordgard marks its flush and runs the effects after it, WordgardDoc
// asks for them once the editor is in the page.
type Editor = EditorContextValue & {
  readonly publish: (state: GardState) => void;
  readonly readMeasures: (wg: Wordgard) => void;
  readonly runEffects: () => void;
  readonly requestEffects: () => void;
  flushing: boolean;
};

const editors = new WeakMap<Wordgard, Editor>();

export const editorOf = (wg: Wordgard): Editor => {
  const found = editors.get(wg);
  if (found) return found;
  let state = wg.state;
  const listeners = new Set<() => void>();
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
    const writes = [...measures].map((measure) => measure());
    // React state set by a write commits now, on the same paint.
    wg.scheduleDOMWrite(() =>
      flushSync(() => {
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
      state = next;
      for (const listener of listeners) listener();
    },
    readMeasures,
    runEffects,
    requestEffects,
    flushing: false,
  };
  editors.set(wg, editor);
  return editor;
};

export const EditorContext = createContext<EditorContextValue | null>(null);

export const useEditorContext = () => {
  const context = useContext(EditorContext);
  if (!context) throw new Error("Used outside a Wordgard editor");
  return context;
};
