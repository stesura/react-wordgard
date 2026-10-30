// Adapted from react-prosemirror's ReactEditorView, to fit Wordgard: it
// extends Wordgard instead of EditorView and, like ReactEditorView with
// ProseMirror's docView, takes over the tile tree the base constructor builds.
import { Wordgard } from "wordgard/editor";

import { ReactDocTile } from "./tile.js";
import type { DocTile } from "./wordgardInternals.js";

export class ReactWordgard
  // @ts-expect-error Wordgard's constructor is private in its typings.
  extends Wordgard
{
  // Exists at runtime; Wordgard's typings omit it.
  declare docTile: DocTile;

  static create = (spec: Wordgard.Spec) => new ReactWordgard(spec);

  // Wordgard's own tests build tile trees through `Wordgard.DocTile`.
  static DocTile = ReactDocTile;

  constructor(spec: Wordgard.Spec) {
    // @ts-expect-error The typings drop the private constructor's parameter.
    super(spec);
    this.docTile = ReactDocTile.adopt(this.docTile);
  }
}
