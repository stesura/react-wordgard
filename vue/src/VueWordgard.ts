// Adapted from react-wordgard's ReactWordgard.ts for Vue: a Wordgard subclass whose document Vue
// draws (VueDocTile). Standalone only, and without useEditorEventListener's handlers: hosting in
// the app's tree and the composables are to come.
import { Wordgard } from "wordgard/editor";

import { editorOf } from "../../src/editorStore.js";
import { RefusedUpdate, observeShapes } from "../../src/tile.js";
import { type DOMObserver, DocTile } from "../../src/wordgardInternals.js";
import { VueDocTile } from "./VueDocTile.js";

// Asks Wordgard for a frame: a no-op read schedules a flush.
const retry = () => {};

export class VueWordgard
  // @ts-expect-error Wordgard's constructor is private in its typings.
  extends Wordgard
{
  // Exists at runtime; Wordgard's typings omit it.
  declare docTile: DocTile;
  declare observer: DOMObserver;
  declare scheduleFlush: () => void;

  static create = (spec: Wordgard.Spec) => new VueWordgard(spec);

  // Wordgard's own tests build tile trees through `Wordgard.DocTile`.
  static DocTile = VueDocTile;

  constructor(spec: Wordgard.Spec) {
    // Wordgard's constructor draws the document with `DocTile.create`, before
    // this one can run: Vue draws it there instead. Put back at once, for any
    // other editor.
    const create = DocTile.create;
    DocTile.create = (state, dom, wg) => {
      if (!(wg instanceof VueWordgard)) return create(state, dom, wg);
      DocTile.create = create;
      return VueDocTile.create(state, dom, wg);
    };
    try {
      // Given a `parent`, it would also put the editor in the page, where
      // connecting measures it: that's left until it's built.
      // @ts-expect-error The typings drop the private constructor's parameter.
      super({ ...spec, parent: undefined });
    } finally {
      DocTile.create = create;
    }
    // The records of decorations' own commits are sorted out of what
    // Wordgard's DOM observer reads.
    this.observer.observer = observeShapes(this, (records) => {
      this.observer.queue.push(...records);
      this.scheduleFlush();
    });
    spec.parent?.appendChild(this.dom);
  }

  flush() {
    const editor = editorOf(this);
    this.observer.queue.push(...this.observer.observer.takeRecords());
    editor.flushing = true;
    try {
      super.flush();
    } catch (error) {
      // The update is still pending: drawn on the next frame.
      if (error instanceof RefusedUpdate) this.scheduleDOMRead(retry);
      throw error;
    } finally {
      editor.flushing = false;
    }
    editor.runEffects();
  }
}
