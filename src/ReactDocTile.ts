// Split from tile.ts: React's renderer for our DocTile. The document is a React tree, committed
// inside Wordgard's flush with flushSync, in a root of its own or, for an editor WordgardEditor
// hosts, through WordgardDoc's portal in the app's tree.
import { type ReactElement, createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import type { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

import { ErrorBoundary } from "./components/ErrorBoundary.js";
import { DocNodeView } from "./components/nodes/DocNodeView.js";
import { EditorContext } from "./contexts/EditorContext.js";
import { NodeWrapperContext } from "./contexts/NodeWrapperContext.js";
import { nodeWrappers } from "./decorations/ReactNodeWrapper.js";
import type { ChildView } from "./decorations/iterDeco.js";
import { editorOf } from "./editorStore.js";
import { reactWords } from "./words.js";
import {
  type HostedRenderer,
  RefusedUpdate,
  RenderedDocTile,
  type Renderer,
  type RendererContext,
  createDocTile,
  hostDocTile,
  mountDocTile,
} from "./tile.js";

// The portal WordgardDoc draws a hosted editor's document through. Its layout
// effect reports each element it commits; `mount` builds the tiles over its
// first commit. Each portal `claim`s the editor first, so `mount` can refuse a
// second one.
export type DocPortal = {
  readonly get: () => ReactElement;
  readonly subscribe: (listener: () => void) => () => void;
  readonly committed: (element: ReactElement) => void;
  readonly claim: () => () => void;
  readonly mount: () => void;
};

const portals = new WeakMap<Element, DocPortal>();

export const docPortal = (dom: Element) => {
  const portal = portals.get(dom);
  if (!portal) throw new Error("This editor isn't hosted by WordgardEditor");
  return portal;
};

// The document's element: a new error boundary after each error, so the next
// render mounts the document anew.
const documentElement = ({ wg, failed }: RendererContext) => {
  let failures = 0;
  const onError = (thrown: unknown) => {
    failed(thrown);
    failures++;
  };
  return (state: GardState, views: readonly ChildView[]) =>
    createElement(
      ErrorBoundary,
      { key: failures, onError },
      createElement(
        EditorContext.Provider,
        { value: editorOf(wg) },
        createElement(
          NodeWrapperContext.Provider,
          { value: state.facet(nodeWrappers.reader) },
          createElement(DocNodeView, { views })
        )
      )
    );
};

const batch = (change: () => void) => flushSync(change);

const redrawsAll = (before: GardState, after: GardState) =>
  before.facet(nodeWrappers.reader) != after.facet(nodeWrappers.reader);

// A React root of its own in the content element.
const reactRoot = (dom: Element, context: RendererContext): Renderer => {
  const root = createRoot(dom);
  const draw = documentElement(context);
  return {
    commit: (state, views, publish) => {
      const element = draw(state, views);
      flushSync(() => {
        publish();
        root.render(element);
      });
    },
    batch,
    redrawsAll,
    words: reactWords,
  };
};

// The document drawn through WordgardDoc's portal, which calls `mount` once it
// committed.
const reactPortal =
  (mount: () => void) =>
  (dom: Element, context: RendererContext): HostedRenderer => {
    const draw = documentElement(context);
    let element: ReactElement | null = null;
    let committed: ReactElement | null = null;
    const listeners = new Set<() => void>();
    let claims = 0;
    portals.set(dom, {
      get: () => {
        if (!element) throw new Error("Nothing to render yet");
        return element;
      },
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      committed: (element) => {
        committed = element;
      },
      claim: () => {
        claims++;
        return () => {
          claims--;
        };
      },
      // The editor's element and content element exist once: a second
      // WordgardDoc would move the first's element and draw the document
      // twice into one content element.
      mount: () => {
        if (claims > 1) throw new Error("This editor is already rendered by another WordgardDoc");
        mount();
      },
    });
    return {
      prepare: (state, views) => {
        element = draw(state, views);
      },
      commit: (state, views, publish) => {
        const next = draw(state, views);
        flushSync(() => {
          publish();
          element = next;
          for (const listener of listeners) listener();
        });
        // flushSync defers inside a React render or commit: React then renders
        // what it last committed.
        if (committed == next) return;
        element = committed;
        throw new RefusedUpdate(
          "ReactWordgard can't update while React renders or commits: read the editor's layout from useEditorEffect or useEditorLayoutEffect, not from a React effect"
        );
      },
      batch,
      redrawsAll,
      words: reactWords,
    };
  };

export class ReactDocTile extends RenderedDocTile {
  static create = (state: GardState, dom: Element, wg: Wordgard) =>
    createDocTile(ReactDocTile, reactRoot, state, dom, wg);

  // For an editor WordgardEditor hosts: React draws the document when
  // WordgardDoc mounts its portal, which then calls `mount`.
  static host = (state: GardState, dom: Element, wg: Wordgard, mount: () => void) =>
    hostDocTile(ReactDocTile, reactPortal(mount), state, dom, wg);

  static mount = mountDocTile;
}
