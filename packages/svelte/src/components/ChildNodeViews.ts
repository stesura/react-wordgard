// Adapted from react-wordgard's ChildNodeViews (by way of vue-wordgard's) for Svelte: what iterDeco
// lays out, drawn into an element as keyed parts. The DOM is ours (helpers/dom.ts): a part keeps
// its DOM while its key does, as React's and Vue's keys keep theirs. A Svelte decoration is a
// component mounted on its own (helpers/mountRoot.ts), its root a part. Native widgets draw
// nothing: the doc tile puts their DOM in place after the commit.
import { Elt } from "wordgard/doc";
import type { Attributes } from "wordgard/doc";

import {
  type ChildView,
  type Words,
  cellOf,
  childViewKeys,
  isComponentWidget,
  shapeOf,
} from "@stesura/wordgard-view";
import { createElement, placeNodes, setAttributes } from "../helpers/dom.js";
import type { Holder } from "../helpers/mountRoot.js";
import { SeparatorHackView } from "./SeparatorHackView.js";
import { TextNodeView } from "./TextNodeView.js";
import { TrailingHackView } from "./TrailingHackView.js";
import { WidgetView } from "./WidgetView.js";
import { MarkView } from "./marks/MarkView.js";
import { DefaultNodeView, type NodePart, destroyNode } from "./nodes/DefaultNodeView.js";

// What one document's drawing shares: its document, the nodes whose cells got
// a view in this commit (drawn once their lists are), where components are
// mounted, and how a component's error is reported. `contexts` are those a
// component mounted here gets: the editor's, or those of the component whose
// content this is.
export type DrawContext = {
  readonly doc: Document;
  readonly dirty: Set<NodePart>;
  readonly words: Words;
  readonly holder: Holder;
  readonly contexts: Map<unknown, unknown>;
  readonly failed: (error: unknown) => void;
  // Run once Svelte has run the effects of what was drawn (its attachments).
  readonly settle: (() => void)[];
};

export type TextPart = {
  readonly kind: "text";
  readonly key: string;
  readonly dom: Text;
  text: string;
};

// An element, its attributes and its children as last drawn. `content` is the
// part of `children` drawn from a list of views (a hole's, a mark's).
export type ElementPart = {
  readonly kind: "element";
  readonly key: string;
  readonly dom: Element;
  readonly tagName: string;
  attrs: Attributes;
  children: readonly Part[];
  content: DrawnList | null;
};

// A Svelte decoration's component, mounted: its root, and `view` naming what
// drew it, which alone updates it.
export type RootPart = {
  readonly kind: "root";
  readonly key: string;
  readonly view: string;
  readonly component: unknown;
  dom: Element;
  readonly update: (props: Record<string, unknown>) => void;
  // Updates what isn't props: the node selection, the root's tag.
  readonly set: (selected: boolean, tagName: string) => void;
  readonly destroy: () => void;
};

export type Part = TextPart | ElementPart | NodePart | RootPart;

// A list of views as drawn, and its shape (iterDeco's shapeOf): a list
// keeping its shape draws as before, the nodes whose cells changed drawing
// themselves.
export type DrawnList = { readonly shape: object; readonly parts: readonly Part[] };

export const destroyPart = (part: Part) => {
  if (part.kind == "node") destroyNode(part);
  else if (part.kind == "element") part.children.forEach(destroyPart);
  else if (part.kind == "root") part.destroy();
};

// Where each part was placed, and what each element holds, for a component's
// root Svelte replaced on its own (helpers/mountRoot.ts). `owners` gives the
// part a root is drawn for (a node's).
const placedIn = new WeakMap<Part, Element>();
const placed = new WeakMap<Element, readonly Part[]>();
export const owners = new WeakMap<Part, Part>();
// Elements whose parts go before the component's own children (a wrapper's).
export const placedFirst = new WeakSet<Element>();

const domsOf = (parts: readonly Part[]) => {
  const nodes: ChildNode[] = [];
  for (const part of parts) if (part.dom) nodes.push(part.dom);
  return nodes;
};

// Puts a root Svelte drew anew where the old one was.
export const replaceRoot = (part: Part, old: Element, root: Element) => {
  if (old.parentNode) {
    old.parentNode.replaceChild(root, old);
    return;
  }
  let top = part;
  for (let owner = owners.get(top); owner; owner = owners.get(top)) top = owner;
  const parent = placedIn.get(top);
  const parts = parent && placed.get(parent);
  if (!parent || !parts) return;
  if (placedFirst.has(parent)) parent.prepend(...domsOf(parts));
  else placeNodes(parent, domsOf(parts));
};

// Makes `parent`'s children `next`, which replace `last`: the parts dropped
// are destroyed and their DOM removed.
export const placeParts = (parent: Element, next: readonly Part[], last: readonly Part[]) => {
  if (next == last) return;
  placed.set(parent, next);
  for (const part of next) placedIn.set(part, parent);
  const kept = new Set(next);
  for (const part of last) {
    if (kept.has(part)) continue;
    const { dom } = part;
    destroyPart(part);
    if (dom?.parentNode == parent) dom.remove();
  }
  placeNodes(parent, domsOf(next));
};

// An element of `tagName` with `attrs`: `before`'s when it's one of that tag.
// Its children are the caller's (`fill`). An element of another tag takes
// `before`'s children, their DOM moved into it, as Wordgard's own update does
// (a mark's `<strong>` becoming `<em>`): React and Vue draw them anew.
export const ElementView = (
  before: Part | undefined,
  key: string,
  tagName: string,
  attrs: Attributes,
  context: DrawContext
): ElementPart => {
  if (before?.kind == "element" && before.tagName == tagName) {
    setAttributes(before.dom, attrs, before.attrs);
    before.attrs = attrs;
    return before;
  }
  const dom = createElement(context.doc, tagName);
  setAttributes(dom, attrs, null);
  const element: ElementPart = {
    kind: "element",
    key,
    dom,
    tagName,
    attrs,
    children: [],
    content: null,
  };
  if (before?.kind == "element") {
    dom.append(...before.dom.childNodes);
    element.children = before.children;
    element.content = before.content;
    before.children = [];
    before.content = null;
  }
  return element;
};

export const fill = (element: ElementPart, children: readonly Part[]) => {
  placeParts(element.dom, children, element.children);
  element.children = children;
};

const byKey = (parts: readonly Part[]) => new Map(parts.map((part) => [part.key, part]));

// The parts of `views`, reusing those of `last` with the same keys.
export const drawChildViews = (
  views: readonly ChildView[],
  last: readonly Part[],
  context: DrawContext
): Part[] => {
  const old = last.length ? byKey(last) : null;
  return childViewKeys(views).flatMap(({ view, key }): Part[] => {
    const before = old?.get(key);
    switch (view.type) {
      case "node":
        return view.shape instanceof Elt || isComponentWidget(view.shape)
          ? [DefaultNodeView(before, key, cellOf(view), context)]
          : [];
      case "text":
        return [TextNodeView(before, key, view.text, context)];
      case "wrapper":
        return [MarkView(before, key, view, context)];
      case "buffer":
        return [SeparatorHackView(before, key, context)];
      case "composition":
        // What we last drew there, which we then never write to; the browser's
        // own node isn't ours to draw.
        return view.rendered === null ? [] : [TextNodeView(before, key, view.rendered, context)];
      case "trailingHack":
        return [TrailingHackView(before, key, context)];
      case "widget":
        return isComponentWidget(view.widget)
          ? [WidgetView(before, key, { widget: view.widget, attrs: [], selected: false }, context)]
          : [];
    }
  });
};

// `views` drawn where `last` was, as it was while the list keeps its shape.
export const drawList = (
  views: readonly ChildView[],
  last: DrawnList | null,
  context: DrawContext
): DrawnList => {
  const shape = shapeOf(views);
  if (last?.shape == shape) return last;
  return { shape, parts: drawChildViews(views, last?.parts ?? [], context) };
};
