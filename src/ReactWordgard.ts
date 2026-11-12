// Adapted from react-prosemirror's ReactEditorView, to fit Wordgard: the editor React draws
// (ReactDocTile). What isn't React's is in RenderedWordgard.ts.
import type { Wordgard } from "wordgard/editor";

import { ReactDocTile } from "./ReactDocTile.js";
import { RenderedWordgard } from "./RenderedWordgard.js";

export class ReactWordgard extends RenderedWordgard {
  // An editor with a React root of its own.
  static create = (spec: Wordgard.Spec) => new ReactWordgard(spec, false);

  // An editor WordgardEditor hosts: its document renders through
  // WordgardDoc's portal, in the app's React tree.
  static host = (spec: Wordgard.Spec) => new ReactWordgard(spec, true);

  // Wordgard's own tests build tile trees through `Wordgard.DocTile`.
  static DocTile = ReactDocTile;

  constructor(spec: Wordgard.Spec, hosted = false) {
    super(spec, ReactDocTile, hosted);
  }
}
