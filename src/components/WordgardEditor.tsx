// Named after react-prosemirror's ProseMirror component, rewritten for Wordgard. The spec is read
// once, as react-prosemirror's `defaultState`: Wordgard's editor owns its state.
import React, { type ReactNode, useState } from "react";
import type { Wordgard } from "wordgard/editor";

import { ReactWordgard } from "../ReactWordgard.js";
import { EditorContext, editorOf } from "../contexts/EditorContext.js";

type Props = Omit<Wordgard.Spec, "parent"> & {
  children?: ReactNode;
};

/**
 * Creates a Wordgard editor from the spec (`doc`, `config`, `selection`, `state`, `scrollTo`) and
 * provides it to its children. It draws no DOM of its own. The spec is read once, on mount: from
 * then on the editor owns its state (see [Accessing the state outside the
 * editor](https://github.com/stesura/react-wordgard#accessing-the-state-outside-the-editor)). In
 * React's StrictMode (development only), it creates its editor twice and drops one, which is never
 * put in the page.
 */
export const WordgardEditor = ({ children, ...spec }: Props) => {
  const [editor] = useState(() => editorOf(ReactWordgard.host(spec)));
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
};
