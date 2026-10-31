// The one place that depends on Wordgard internals missing from its typings
// (src/editor/tile.ts, decoration.ts and editor.ts, and src/doc/node.ts in its
// repo, at the pinned version). The declarations below are trusted, not
// checked: re-read them against Wordgard's source after `npm run
// update-wordgard`.
import type { Node as DocNode, Elt, Mark } from "wordgard/doc";
import { Widget, Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";
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
  // The queries Wordgard's input, selection and coordinates code use.
  resolve(pos: number, side?: -1 | 1): { tile: Tile; offset: number; pos: number };
  nodeTile(pos: number): Tile | null;
  posFromDOM(dom: Node, offset: number, bias?: -1 | 1): number;
}

export interface DOMObserver {
  ignore<T>(f: () => T): T;
}

interface DocTileClass {
  new (state: GardState, dom: Element, cursorWrapper: Mark.Set | null, decoSet: unknown): DocTile;
  create(state: GardState, dom: Element, wg: Wordgard): DocTile;
}

export interface EltTile extends CompositeTile {
  readonly elt: Elt;
}

interface EltTileClass {
  new (elt: Elt, tag: DocNode.Tag | null, flags: number, length: number, dom: Element): EltTile;
  of(
    elt: Elt,
    tag: DocNode.Tag | null,
    flags: number,
    length: number,
    dom?: Element | null
  ): EltTile;
}

export interface TextTile extends Tile {
  text: string;
  dom: Text;
}

interface TextTileClass {
  new (text: string, dom: Text, flags?: number): TextTile;
}

export interface WidgetTile extends Tile {
  readonly widget: Widget;
}

interface WidgetTileClass {
  new (
    widget: Widget,
    tag: DocNode.Tag | null,
    flags: number,
    dom: Element | Text,
    length?: number
  ): WidgetTile;
}

// Wordgard's `TileFlag`, a const enum its typings declare without exporting.
export const TileFlag = {
  PlotContent: 0x2,
  Point: 0x10,
  PointAfter: 0x40,
  Synced: 0x100,
  Dirty: 0x2000,
} as const;

declare module "wordgard/doc" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Plot {
    // Wordgard's NodeShape: the element a node type renders as.
    interface Type<Param = unknown> {
      readonly shape: { readonly atom: boolean; create(param: Param): Elt };
    }
  }
}

// Makes `Wordgard.DocTile` and `Widget.br` visible to anything that loads
// these types; the instance's `docTile` is declared on ReactWordgard only.
declare module "wordgard/editor" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Wordgard {
    const DocTile: DocTileClass;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Widget {
    // The `<br>` Wordgard puts at the end of a textblock that needs one.
    const br: Widget<null>;
  }
}

export const DocTile = Wordgard.DocTile;

let tileClasses: { EltTile: EltTileClass; TextTile: TextTileClass; WidgetTile: WidgetTileClass };

// Wordgard doesn't expose its other tile classes, and its code checks
// `instanceof TextTile`, so we take them from a tree it builds, once. Their
// types come from `Object.getPrototypeOf`'s `any`: unchecked, like the
// declarations above.
export const getTileClasses = () => {
  if (tileClasses) return tileClasses;
  const wg = Wordgard.create({ doc: "<p>x</p><p></p>", config: [basicSchema()] });
  const [text, empty] = wg.contentDOM.children;
  const classOf = (dom: Node | null | undefined) => {
    if (!dom?.wgTile) throw new Error("Wordgard's tile tree has an unexpected shape");
    return Object.getPrototypeOf(dom.wgTile).constructor;
  };
  tileClasses = {
    EltTile: classOf(text),
    TextTile: classOf(text?.firstChild),
    WidgetTile: classOf(empty?.firstChild),
  };
  return tileClasses;
};
