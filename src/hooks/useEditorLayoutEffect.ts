// The other half of react-prosemirror's useEditorEffect, which ran inside
// React's commit: what it set showed on the same paint. Here React commits
// inside Wordgard's flush, so useEditorEffect runs after it, and this hook
// runs in it, as React's useLayoutEffect to useEffect. It measures the
// editor's layout and writes from it on the same paint as the document update:
// `read` runs in every flush's read phase, `write` with its result in the
// write phase after (Wordgard's scheduleDOMRead and scheduleDOMWrite), React
// state it sets committing there too. A write that changes the size of the
// editor's content makes Wordgard update and measure again within the flush,
// so pagination can settle there. Neither may dispatch (Wordgard throws during
// its flush): dispatch from useEditorEffect or an event handler. Writes into
// the document's own DOM are foreign edits to Wordgard: write inside widgets,
// outside the editor, or through decorations.
import { useLayoutEffect, useRef } from "react";
import type { Wordgard } from "wordgard/editor";

import { useEditorContext } from "../contexts/EditorContext.js";

export type EditorLayoutEffect<T> = {
  read: (wg: Wordgard) => T;
  write: (value: T, wg: Wordgard) => void;
};

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
      return () => write(value, wg);
    };
    measures.add(entry);
    requestMeasure();
    return () => {
      measures.delete(entry);
    };
  }, [wg, measures, requestMeasure]);
};
