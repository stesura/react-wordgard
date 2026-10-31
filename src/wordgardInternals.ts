// The one place that depends on Wordgard internals missing from its typings
// (src/editor/tile.ts, decoration.ts and editor.ts, and src/doc/node.ts in its
// repo, at the pinned version). The declarations below are trusted, not
// checked: re-read them against Wordgard's source after `npm run
// update-wordgard`.
import { type Attributes, type Node as DocNode, Elt, type Mark } from "wordgard/doc";
import { Decoration, Widget, Wordgard } from "wordgard/editor";
import { basicSchema } from "wordgard/schema";
import { GardState } from "wordgard/state";
import { Emphasis, Image, Paragraph } from "wordgard/types";

// Declared in Wordgard's typings for `Node.wgTile`, but not exported.
export type Tile = NonNullable<Node["wgTile"]>;
export type CompositeTile = NonNullable<Tile["parent"]>;

// Wordgard's DecoSet: the sets each point and range decoration source gave.
export type DecoSet = {
  readonly points: Map<(state: GardState) => Decoration.Point.Set, Decoration.Point.Set>;
  readonly ranges: Map<(state: GardState) => Decoration.Range.Set, Decoration.Range.Set>;
};

export interface DocTile extends CompositeTile {
  readonly state: GardState;
  readonly cursorWrapper: Mark.Set | null;
  readonly decoSet: DecoSet;
  // Diffs the decorations, then calls `updateRanges` with the ranges to redraw.
  update(
    state: GardState,
    changes: readonly number[],
    wg: Wordgard,
    composition?: CompositionInfo | null
  ): DocTile;
  updateRanges(
    state: GardState,
    decoSet: DecoSet,
    changes: readonly number[],
    wg: Wordgard,
    composition?: CompositionInfo | null
  ): DocTile;
  // The queries Wordgard's input, selection and coordinates code use.
  resolve(pos: number, side?: -1 | 1): { tile: Tile; offset: number; pos: number };
  nodeTile(pos: number): Tile | null;
  posFromDOM(dom: Node, offset: number, bias?: -1 | 1): number;
}

// What Wordgard's flush tells the doc tile about an ongoing composition: the
// browser's text node (`target`) and the range it covers, or, when typing with
// marks and no text yet, the marks to wrap the cursor in.
export interface CompositionInfo {
  readonly fromB: number;
  readonly toB: number;
  readonly text: string;
  readonly target: Text | null;
  readonly wrapCursor?: Mark.Set | null;
}

export interface DOMObserver {
  ignore<T>(f: () => T): T;
}

interface DocTileClass {
  new (state: GardState, dom: Element, cursorWrapper: Mark.Set | null, decoSet: DecoSet): DocTile;
  create(state: GardState, dom: Element, wg: Wordgard): DocTile;
}

export interface EltTile extends CompositeTile {
  readonly elt: DecoElt;
}

interface EltTileClass {
  new (elt: DecoElt, tag: DocNode.Tag | null, flags: number, length: number, dom: Element): EltTile;
  of(
    elt: DecoElt,
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
  NodeInner: 0x1,
  PlotContent: 0x2,
  Spanning: 0x4,
  Wrapper: 0x8,
  Point: 0x10,
  PointBefore: 0x20,
  PointAfter: 0x40,
  Composition: 0x80,
  Synced: 0x100,
  Atom: 0x200,
  AfterContent: 0x800,
  Dirty: 0x2000,
} as const;

// Wordgard's `Reused`, how a tile of the previous tree was used in the new one:
// whole (`Full`, not disconnected), or for its DOM only.
export const Reused = { Full: 1, DOM: 2 } as const;

// Wordgard's NodeShape: the element a node type renders as.
interface NodeShape<Param> {
  readonly atom: boolean;
  create(param: Param): Elt;
}

// Wordgard's `Elt.Selector`, opaque here: we only hand it back to `addAttrs`.
export interface EltSelector {
  match(elt: Elt): boolean;
}

declare module "wordgard/doc" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Plot {
    interface Type<Param = unknown> {
      readonly shape: NodeShape<Param>;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Leaf {
    interface Type<Param = unknown> {
      readonly shape: NodeShape<Param>;
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Mark {
    // A mark type has either an element or an attribute shape.
    interface Type<Param = unknown> {
      readonly rank: number;
      readonly element: { readonly name: string; attrs(value: Param): Attributes } | null;
      readonly attribute: {
        get(value: Param): Attributes;
        readonly target: EltSelector | null;
      } | null;
    }
  }
  interface Elt<T = string> {
    // Merges onto the element `target` matches, or else onto this one.
    addAttrs(attrs: Attributes, target?: EltSelector): Elt<T>;
    // Puts `wrapper` around the element `target` matches, or else this one.
    wrap(wrapper: Elt<T>, target?: EltSelector): Elt<T>;
    // A copy with `content` in the hole.
    fill(content: readonly (0 | T | Elt<T>)[]): Elt<T>;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Attributes {
    // Adds an attribute to a sorted set, joining `class` and `style` values.
    function push(attrs: string[], name: string, value: string): void;
  }
}

// Makes `Wordgard.DocTile` and `Widget.br` visible to anything that loads
// these types; the instance's `docTile` is declared on ReactWordgard only.
declare module "wordgard/editor" {
  interface Widget<Param = unknown> {
    // Always false: a widget is a shape without content.
    readonly hasContent: boolean;
    render(wg: Wordgard): Element | Text;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Wordgard {
    const DocTile: DocTileClass;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Widget {
    interface Type<Param> {
      // Whether the widget takes up room in the text (`inFlow` in its spec).
      readonly inFlow: boolean;
      // Whether its DOM is left editable.
      readonly editable: boolean;
    }
    // The `<br>` Wordgard puts at the end of a textblock that needs one.
    const br: Widget<null>;
    // The `<img class="wg-buffer">` at the start and end of an inline plot.
    const img: Widget<null>;
    // Text inside a node's shape.
    const text: Widget.Type<string>;
    // A text node's own shape.
    const editableText: Widget.Type<string>;
  }
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Decoration {
    interface Range {
      readonly query: DocNode.Query | null;
      // DecorationScope and Inc, const enums.
      readonly scope: number;
      readonly inc: number;
    }
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

// What decorations look like inside Wordgard: classes and facets its
// typings don't declare.
export type DecoElt = Elt<Widget | string>;

export interface WidgetDecoration extends Decoration.Point {
  readonly widget: Widget;
}
export interface ShapeDecoration extends Decoration.Point {
  readonly shape: Decoration.Shape;
}
export interface AttributeDecoration extends Decoration.Point {
  readonly attrs: Attributes;
  readonly selector: EltSelector | null;
}
export interface WrapperDecoration extends Decoration.Point {
  readonly elt: DecoElt;
  readonly selector: EltSelector | null;
}
export interface WrapperRangeDecoration extends Decoration.Range {
  readonly elt: DecoElt;
  readonly rank: number;
  readonly spanning: boolean;
}
export interface AttributeRangeDecoration extends Decoration.Range {
  readonly attribute: string;
  readonly value: string;
}

export type TagShape = {
  readonly type: DocNode.Type;
  readonly shape: (tag: DocNode.Tag) => Decoration.Shape;
};
export type TagWidget = {
  readonly type: DocNode.Type;
  // WidgetPlace: before 0, after 1, start 2, end 3.
  readonly place: number;
  readonly widget: Widget | ((tag: DocNode.Tag) => Widget | null);
};
export type TagWrapper = {
  readonly type: DocNode.Type;
  readonly elt: DecoElt;
  readonly target: EltSelector | null;
};
export type TagAttribute = {
  readonly type: DocNode.Type;
  readonly attr: string;
  readonly value: (tag: DocNode.Tag) => string;
  readonly target: EltSelector | null;
};

type Class<T> = new (...args: never[]) => T;

let decorationInternals: {
  WidgetDecoration: Class<WidgetDecoration>;
  ShapeDecoration: Class<ShapeDecoration>;
  AttributeDecoration: Class<AttributeDecoration>;
  WrapperDecoration: Class<WrapperDecoration>;
  WrapperRangeDecoration: Class<WrapperRangeDecoration>;
  AttributeRangeDecoration: Class<AttributeRangeDecoration>;
  tagShape: GardState.Facet<TagShape, Map<DocNode.Type, (tag: DocNode.Tag) => Decoration.Shape>>;
  tagWidget: GardState.Facet<TagWidget, readonly TagWidget[]>;
  tagWrapper: GardState.Facet<TagWrapper, readonly TagWrapper[]>;
  tagAttribute: GardState.Facet<TagAttribute, readonly TagAttribute[]>;
  markShape: GardState.Facet<unknown, Map<Mark.Type, Mark.Type>>;
};

// The facet a provider (what `Facet.of` returns) is for.
const facetOf = (extension: GardState.Extension) => {
  if (
    typeof extension == "object" &&
    extension &&
    "facet" in extension &&
    extension.facet instanceof GardState.Facet
  )
    return extension.facet;
  throw new Error("Wordgard's decoration facets have an unexpected shape");
};

// Wordgard's decoration classes and facets, taken from what its public
// factories return, once. Typed through `any` (`getPrototypeOf`, `instanceof`
// on a generic class): unchecked, like the declarations above.
export const getDecorationInternals = () => {
  if (decorationInternals) return decorationInternals;
  const classOf = (value: object) => Object.getPrototypeOf(value).constructor;
  decorationInternals = {
    WidgetDecoration: classOf(Decoration.Point.widget(Widget.br)),
    ShapeDecoration: classOf(Decoration.Point.shape(Elt.mk("span"))),
    AttributeDecoration: classOf(Decoration.Point.attributes({})),
    WrapperDecoration: classOf(Decoration.Point.wrapper(Elt.mk("span", [0]))),
    WrapperRangeDecoration: classOf(Decoration.Range.wrapper("span", {})),
    AttributeRangeDecoration: classOf(Decoration.Range.attribute("data-x", "")),
    tagShape: facetOf(Decoration.Tag.shape(Image, Elt.mk("img"))),
    tagWidget: facetOf(Decoration.Tag.widget(Paragraph, "before", Widget.br)),
    tagWrapper: facetOf(Decoration.Tag.wrapper(Paragraph, Elt.mk("div", [0]))),
    tagAttribute: facetOf(Decoration.Tag.attribute(Paragraph, "data-x", "")),
    markShape: facetOf(Decoration.Mark.shape(Emphasis, { element: "i" })),
  };
  return decorationInternals;
};
