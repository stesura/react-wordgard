// Adapted from react-prosemirror's ReactEditorView, to fit Wordgard: it extends Wordgard, and its
// base constructor builds a tile tree a framework renders, where ReactEditorView replaces the
// docView. Split from ReactWordgard.ts, without React, for each framework's editor to extend.
import { Wordgard } from "wordgard/editor";
import { GardState } from "wordgard/state";

import { editorEventHandlers, hasEditorEventHandlers } from "./contexts/editorEvents.js";
import { editorOf } from "./editorStore.js";
import { RefusedUpdate, mountDocTile, observeShapes } from "./tile.js";
import { type DOMObserver, DocTile } from "./wordgardInternals.js";

// Asks Wordgard for a frame: a no-op read schedules a flush.
const retry = () => {};

// A framework's doc tiles: drawn at once (`create`), or once the app mounts the
// document (`host`, which then calls `mount`).
export type DocTiles = {
  readonly create: (state: GardState, dom: Element, wg: Wordgard) => DocTile;
  readonly host: (state: GardState, dom: Element, wg: Wordgard, mount: () => void) => DocTile;
};

export class RenderedWordgard
  // @ts-expect-error Wordgard's constructor is private in its typings.
  extends Wordgard
{
  // Exists at runtime; Wordgard's typings omit it.
  declare docTile: DocTile;
  declare observer: DOMObserver;
  declare scheduleFlush: () => void;

  constructor(spec: Wordgard.Spec, tiles: DocTiles, hosted: boolean) {
    // Wordgard's constructor draws the document with `DocTile.create`, before
    // this one can run: the framework draws it there instead, so it's drawn
    // once. Put back at once, for any editor the framework's render creates;
    // other editors created first (by a plugin) draw as before.
    const create = DocTile.create;
    const Self = new.target;
    const self: { editor: RenderedWordgard | null } = { editor: null };
    DocTile.create = (state, dom, wg) => {
      if (!(wg instanceof Self)) return create(state, dom, wg);
      DocTile.create = create;
      if (!hosted) return tiles.create(state, dom, wg);
      return tiles.host(state, dom, wg, () => {
        const { editor } = self;
        if (editor)
          editor.docTile = editor.observer.ignore(() =>
            mountDocTile(editor.contentDOM, editor, editor.docTile)
          );
      });
    };
    // Given a `parent`, it would also put the editor in the page, where
    // connecting measures it: that's left until it's built.
    // useEditorEventListener's handlers come first; Wordgard keeps one copy of
    // an extension, so a state taken from another editor is fine.
    const events = spec.state
      ? {
          state: spec.state.update({ effects: GardState.appendConfig.of(editorEventHandlers) })
            .state,
        }
      : { config: [editorEventHandlers, spec.config ?? []] };
    try {
      // @ts-expect-error The typings drop the private constructor's parameter.
      super({ ...spec, ...events, parent: undefined });
    } finally {
      DocTile.create = create;
    }
    self.editor = this;
    // Shapes' own commits are sorted out of what Wordgard's DOM observer
    // reads; replaced before the editor is connected and observes.
    this.observer.observer = observeShapes(this, (records) => {
      this.observer.queue.push(...records);
      this.scheduleFlush();
    });
    spec.parent?.appendChild(this.dom);
  }

  // Wordgard's flush runs from an animation frame and from the methods that
  // need an up-to-date DOM; useEditorEffect's effects run after it. A refused
  // update leaves Wordgard's transactions pending with no frame requested for
  // them, so one is.
  flush() {
    const editor = editorOf(this);
    // Shapes that committed since their records were delivered get their
    // tiles first (taking the records rebuilds them): Wordgard reads them
    // before the build.
    this.observer.queue.push(...this.observer.observer.takeRecords());
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
    // A reconfiguration (GardState.reconfigure) dropped useEditorEventListener's
    // handlers: they come back with a transaction of their own.
    if (!hasEditorEventHandlers(this.state))
      this.dispatch({ effects: GardState.appendConfig.of(editorEventHandlers) });
  }
}
