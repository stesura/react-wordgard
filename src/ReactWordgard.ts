// Adapted from react-prosemirror's ReactEditorView, to fit Wordgard: it
// extends Wordgard instead of EditorView and, like ReactEditorView with
// ProseMirror's docView, replaces the tile tree the base constructor builds
// with one React renders.
import { Wordgard } from "wordgard/editor";

import { ReactDocTile } from "./tile.js";
import type { DOMObserver, DocTile } from "./wordgardInternals.js";

export class ReactWordgard
  // @ts-expect-error Wordgard's constructor is private in its typings.
  extends Wordgard
{
  // Exists at runtime; Wordgard's typings omit it.
  declare docTile: DocTile;
  declare observer: DOMObserver;

  static create = (spec: Wordgard.Spec) => new ReactWordgard(spec);

  // Wordgard's own tests build tile trees through `Wordgard.DocTile`.
  static DocTile = ReactDocTile;

  constructor(spec: Wordgard.Spec) {
    // @ts-expect-error The typings drop the private constructor's parameter.
    super(spec);
    // Wordgard's constructor has already drawn the document once; there's no
    // way in before it. With a `parent` in the page, its DOM observer is
    // already watching, so React's first commit mustn't count as an edit. Its
    // widgets were connected there, and go as an update would drop them.
    if (this.connected) this.docTile.disconnect();
    this.docTile = this.observer.ignore(() =>
      ReactDocTile.create(this.state, this.contentDOM, this)
    );
  }
}
