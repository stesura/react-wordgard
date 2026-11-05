// The other half of react-prosemirror's useEditorEffect, which ran inside React's commit. Here
// React commits inside Wordgard's flush: useEditorEffect runs after it, this hook in it, through
// Wordgard's scheduleDOMRead and scheduleDOMWrite. A write resizing the content makes Wordgard
// measure again within the flush, so pagination settles there. Writes into the document's own DOM
// are foreign edits to Wordgard: write inside widgets, outside the editor, or through decorations.
import { useLayoutEffect, useRef } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

/** The `read` and `write` pair `useEditorLayoutEffect` takes. */
export type EditorLayoutEffect<T> = {
  read: (wg: Wordgard) => T | undefined;
  write: (value: T, wg: Wordgard) => void;
};

/**
 * Runs inside every editor update, without re-rendering: `read` in Wordgard's read phase, then
 * `write` with its value in the write phase, on the same paint as the document. For what moves with
 * the text (markers in the margin, pagination). It can't dispatch: Wordgard throws during its
 * update. A `read` returning `undefined` skips its write, and when no read asks for a write, none
 * is scheduled, which spares Wordgard measuring again. Reads run in the order the effects were
 * registered.
 */
export const useEditorLayoutEffect = <T>(measure: EditorLayoutEffect<T>) => {
  const { wg, measures, requestMeasure } = useEditorContext();
  const latest = useRef(measure);
  useLayoutEffect(() => {
    latest.current = measure;
  });
  useLayoutEffect(() => {
    const entry = () => {
      const { read, write } = latest.current;
      const value = read(wg);
      return value === undefined ? null : () => write(value, wg);
    };
    measures.add(entry);
    requestMeasure();
    return () => {
      measures.delete(entry);
    };
  }, [wg, measures, requestMeasure]);
};
