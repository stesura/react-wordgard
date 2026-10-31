// Named after react-prosemirror's ProseMirror component, rewritten for
// Wordgard: creates the editor and provides it to what it holds, WordgardDoc
// and the app's own components (menus, hooks). The spec is read once, as
// react-prosemirror's `defaultState`: Wordgard's editor owns its state, so
// changes go through `dispatch`, and configuration through Wordgard's
// compartments or `GardState.appendConfig`.
import React, { type ReactNode, useState } from "react";
import type { Wordgard } from "wordgard/editor";

import { ReactWordgard } from "../ReactWordgard.js";
import { EditorContext, editorOf } from "../contexts/EditorContext.js";

type Props = Omit<Wordgard.Spec, "parent"> & {
  children?: ReactNode;
};

export const WordgardEditor = ({ children, ...spec }: Props) => {
  const [editor] = useState(() => editorOf(ReactWordgard.host(spec)));
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
};
