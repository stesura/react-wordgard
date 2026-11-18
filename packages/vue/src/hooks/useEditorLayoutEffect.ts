// Adapted from react-wordgard's useEditorLayoutEffect for Vue. Setup runs once, so `read` and
// `write` read the component's state as it is when they run: no latest-value ref. Registered before
// mounting, in the patch: a document WordgardDoc mounts runs its `onMounted` a tick later.
import type { Wordgard } from "wordgard/editor";

import { followEditor, useEditorSource } from "../contexts/EditorContext.js";

/** The `read` and `write` pair `useEditorLayoutEffect` takes. */
export type EditorLayoutEffect<T> = {
  read: (wg: Wordgard) => T | undefined;
  write: (value: T, wg: Wordgard) => void;
};

/**
 * Runs inside every editor update, without rendering: `read` in Wordgard's read phase, then `write`
 * with its value in the write phase, on the same paint as the document. For what moves with the
 * text (markers in the margin, pagination). It can't dispatch: Wordgard throws during its update. A
 * `read` returning `undefined` skips its write, and when no read asks for a write, none is
 * scheduled, which spares Wordgard measuring again. Reads run in the order the effects were
 * registered. Under a `WordgardScope`, it moves to the editor the scope gives.
 */
export const useEditorLayoutEffect = <T>({ read, write }: EditorLayoutEffect<T>) =>
  followEditor(
    useEditorSource("useEditorLayoutEffect"),
    ({ wg, measures, requestMeasure }) => {
      const entry = () => {
        const value = read(wg);
        return value === undefined ? null : () => write(value, wg);
      };
      measures.add(entry);
      requestMeasure();
      return () => {
        measures.delete(entry);
      };
    },
    true
  );
