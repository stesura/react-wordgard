// The one place that depends on Wordgard internals missing from its typings
// (src/editor/tile.ts and editor.ts in its repo, at the pinned version). The
// declarations below are trusted, not checked: re-read them against Wordgard's
// source after `npm run update-wordgard`.
import type { Mark } from "wordgard/doc";
import { Wordgard } from "wordgard/editor";
import type { GardState } from "wordgard/state";

// Declared in Wordgard's typings for `Node.wgTile`, but not exported.
export type Tile = NonNullable<Node["wgTile"]>;
export type CompositeTile = NonNullable<Tile["parent"]>;

export interface DocTile extends CompositeTile {
  readonly state: GardState;
  readonly cursorWrapper: Mark.Set | null;
  // Wordgard's DecoSet and CompositionInfo; we only pass them through.
  readonly decoSet: unknown;
  update(
    state: GardState,
    changes: readonly number[],
    wg: Wordgard,
    composition?: unknown
  ): DocTile;
}

interface DocTileClass {
  new (state: GardState, dom: Element, cursorWrapper: Mark.Set | null, decoSet: unknown): DocTile;
  create(state: GardState, dom: Element, wg: Wordgard): DocTile;
}

// Makes `Wordgard.DocTile` visible to anything that loads these types; the
// instance's `docTile` is declared on ReactWordgard only.
declare module "wordgard/editor" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Wordgard {
    const DocTile: DocTileClass;
  }
}

export const DocTile = Wordgard.DocTile;
