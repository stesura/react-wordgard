// Adapted from react-prosemirror's ReactEditorView, to fit Wordgard: it
// extends Wordgard instead of EditorView and, like ReactEditorView with
// ProseMirror's docView, replaces the tile tree the base constructor builds
// with one React renders.
import { Wordgard } from "wordgard/editor";

import { editorOf } from "./contexts/EditorContext.js";
import { ReactDocTile, RefusedUpdate } from "./tile.js";
import type { DOMObserver, DocTile } from "./wordgardInternals.js";

// Asks Wordgard for a frame: a no-op read schedules a flush.
const retry = () => {};

export class ReactWordgard
  // @ts-expect-error Wordgard's constructor is private in its typings.
  extends Wordgard
{
  // Exists at runtime; Wordgard's typings omit it.
  declare docTile: DocTile;
  declare observer: DOMObserver;

  // An editor with a React root of its own.
  static create = (spec: Wordgard.Spec) => new ReactWordgard(spec, false);

  // An editor WordgardEditor hosts: its document renders through
  // WordgardDoc's portal, in the app's React tree.
  static host = (spec: Wordgard.Spec) => new ReactWordgard(spec, true);

  // Wordgard's own tests build tile trees through `Wordgard.DocTile`.
  static DocTile = ReactDocTile;

  constructor(spec: Wordgard.Spec, hosted = false) {
    // @ts-expect-error The typings drop the private constructor's parameter.
    super(spec);
    // Wordgard's constructor has already drawn the document once; there's no
    // way in before it. With a `parent` in the page, its DOM observer is
    // already watching, so React's first commit mustn't count as an edit. Its
    // widgets were connected there, and go as an update would drop them.
    if (this.connected) this.docTile.disconnect();
    this.docTile = this.observer.ignore(() =>
      hosted
        ? ReactDocTile.host(this.state, this.contentDOM, this, () => {
            this.docTile = this.observer.ignore(() =>
              ReactDocTile.mount(this.contentDOM, this, this.docTile)
            );
          })
        : ReactDocTile.create(this.state, this.contentDOM, this)
    );
  }

  // Wordgard's flush runs from an animation frame and from the methods that
  // need an up-to-date DOM; useEditorEffect's effects run after it. A refused
  // update leaves Wordgard's transactions pending with no frame requested for
  // them, so one is.
  flush() {
    const editor = editorOf(this);
    editor.flushing = true;
    try {
      super.flush();
    } catch (error) {
      if (error instanceof RefusedUpdate) this.scheduleDOMRead(retry);
      throw error;
    } finally {
      editor.flushing = false;
    }
    editor.runEffects();
  }
}
