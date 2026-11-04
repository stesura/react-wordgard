// Gives the components it holds an editor a WordgardEditor made elsewhere, in
// place of the one around them: a toolbar acting on whichever of a page's
// editors has focus (a document's, an open header's). The hooks under it
// follow when `wg` changes: selectors subscribe to the new editor's state,
// callbacks and listeners get it, effects run again.
import React, { type ReactNode } from "react";
import type { Wordgard } from "wordgard/editor";

import { EditorContext, findEditor } from "../contexts/EditorContext.js";

type Props = {
  wg: Wordgard;
  children?: ReactNode;
};

export const WordgardScope = ({ wg, children }: Props) => {
  const editor = findEditor(wg);
  if (!editor) throw new Error("WordgardScope takes an editor a WordgardEditor made");
  return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
};
