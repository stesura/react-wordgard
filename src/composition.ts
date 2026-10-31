// How the React view keeps a composition alive through Wordgard's flush, as
// Wordgard's ContentUpdate.composition does (src/editor/tile.ts in its repo):
// the browser's text node stays as it is, in a tile of its own. React must not
// write to it: when React drew it, React keeps rendering the value it last
// committed there, in the wrappers it committed around it; when the browser
// made it (or an element around it), React draws nothing in its place.
import { Attributes, Elt, type Mark, type Plot } from "wordgard/doc";

import {
  type CompositionLayout,
  type WrapperView,
  cursorWrappers,
} from "./decorations/iterDeco.js";
import { type CompositionInfo, TileFlag, getTileClasses } from "./wordgardInternals.js";

// What React last rendered into a text node, under which key.
export type RenderedText = { readonly key: string; readonly text: string };

// What React last committed: text nodes, and the keys of wrapper elements.
export type Rendered = {
  readonly texts: WeakMap<Text, RenderedText>;
  readonly wrappers: WeakMap<Element, string>;
};

export type CompositionView = {
  // The plot holding the composition, and the plots down to it, which
  // re-render through their props when the composition changes.
  readonly plot: Plot;
  readonly path: ReadonlySet<Plot>;
  readonly layout: CompositionLayout;
  readonly target: Text | null;
  // What sits in the composition's place: the target, or the outermost element
  // the browser put around it.
  readonly node: ChildNode | null;
  readonly text: string;
  // The marks typed with when there's no text yet (Wordgard's DocTile keeps them).
  readonly wrapCursor: Mark.Set | null;
  // React's text node and what it holds for React, or null for the browser's.
  readonly rendered: RenderedText | null;
};

// The innermost plot holding [from, to), and the plots down to it.
const plotAround = (doc: Plot, from: number, to: number) => {
  const path = new Set<Plot>();
  let plot = doc;
  let start = 0;
  for (;;) {
    let pos = start;
    let next: { plot: Plot; start: number } | null = null;
    for (const child of plot.content) {
      if (child.isPlot && pos + 1 <= from && to <= pos + child.length - 1) {
        next = { plot: child, start: pos + 1 };
        break;
      }
      pos += child.length;
    }
    if (!next) return { plot, start, path };
    path.add(next.plot);
    ({ plot, start } = next);
  }
};

// An element React put there: one of its wrappers, or what holds a plot's
// content.
const isReacts = (dom: Node, rendered: Rendered) =>
  (dom instanceof Element && rendered.wrappers.has(dom)) ||
  !!dom.wgTile?.isDoc ||
  !!(dom.wgTile && dom.wgTile.flags & TileFlag.PlotContent);

// The outermost node around `target` that React didn't put there.
const browserMade = (target: Text, rendered: Rendered) => {
  let node: ChildNode = target;
  while (node.parentNode instanceof Element && !isReacts(node.parentNode, rendered))
    node = node.parentNode;
  return node;
};

// The wrappers `node` sits in, outermost first, as the tiles over them say
// (ContentUpdate.composition walks up to the node), with React's keys.
const domWrappers = (node: ChildNode, rendered: Rendered) => {
  const wrappers: WrapperView[] = [];
  for (let dom = node.parentNode; dom instanceof Element; dom = dom.parentNode) {
    const tile = dom.wgTile;
    if (!(tile instanceof getTileClasses().EltTile) || !(tile.flags & TileFlag.Wrapper)) break;
    wrappers.unshift({ elt: tile.elt, spanning: tile.isSpanning, key: rendered.wrappers.get(dom) });
  }
  return wrappers;
};

// Wordgard's separateChange fails, and the flush drops the composition, when a
// replaced range reaches across the composition's edges.
const separates = (changes: readonly number[], fromB: number, toB: number) => {
  for (let i = 0, posB = 0; i < changes.length; i += 2) {
    const len = changes[i] ?? 0;
    const ins = changes[i + 1] ?? 0;
    const endB = posB + (ins < 0 ? len : ins);
    if (ins >= 0 && fromB < endB && toB > posB && (posB < fromB || endB > toB)) return false;
    posB = endB;
  }
  return true;
};

export const compositionView = (
  doc: Plot,
  info: CompositionInfo,
  changes: readonly number[],
  rendered: Rendered
): CompositionView | null => {
  if (!separates(changes, info.fromB, info.toB)) return null;
  const { plot, start, path } = plotAround(doc, info.fromB, info.toB);
  const node = info.target && browserMade(info.target, rendered);
  return {
    plot,
    path,
    layout: {
      from: info.fromB - start,
      to: info.toB - start,
      wrappers: node ? domWrappers(node, rendered) : cursorWrappers(info.wrapCursor ?? []),
      cursor: !info.target,
    },
    target: info.target,
    node,
    text: info.text,
    wrapCursor: info.wrapCursor ?? null,
    rendered: (info.target && node == info.target && rendered.texts.get(info.target)) || null,
  };
};

// The tile Wordgard's ContentUpdate.composition makes for an element the
// browser put around the composed text: its tag and attributes, a content hole.
export const browserElt = (dom: Element) =>
  Elt.create(
    dom.nodeName.toLowerCase(),
    Attributes.read(
      Object.fromEntries(dom.getAttributeNames().map((name) => [name, dom.getAttribute(name)]))
    ),
    [0]
  );

// The composition's React key: the key of React's node it's in, if any.
export const compositionKey = (composition: CompositionView | null | undefined) =>
  composition?.rendered?.key ?? "composition";
