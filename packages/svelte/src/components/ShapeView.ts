// Adapted from react-wordgard's ShapeView (by way of vue-wordgard's) for Svelte: a Svelte shape's
// component, mounted, Wordgard's attributes among its props for its root. Its content goes in the
// element it attaches `contentDOMRef` to, or its root. Its own updates are sorted out of Wordgard's
// DOM observer (`sortRecords`).
import type { Node } from "wordgard/doc";

import {
  type ChildView,
  type DecoElt,
  attrsToRecord,
  createDecorationHandlers,
  createShapeHandle,
  decorationRoot,
  nodePos,
  shapeAttributes,
} from "@stesura/wordgard-view";
import { shapeComponent } from "../decorations/SvelteShapeType.js";
import { type Slot, createSlot } from "../helpers/slot.js";
import {
  type DrawContext,
  type DrawnList,
  type Part,
  type RootPart,
  destroyPart,
  drawList,
  placeParts,
} from "./ChildNodeViews.js";
import { mountDecoration } from "./DecorationView.js";

export type ShapeDraw = {
  readonly elt: DecoElt;
  readonly node: Node;
  // The content's views, null for an atom.
  readonly views: readonly ChildView[] | null;
  readonly selected: boolean;
  // Also given the root: a wrapper's, when this shape is what it wraps.
  readonly rooted?: (root: Element) => void;
};

// A list of views drawn into a slot: a shape's or a mark's content.
export type Content = {
  views: readonly ChildView[] | null;
  list: DrawnList | null;
  placed: readonly Part[];
};

// Draws `content` into `element`, which holds the content only: Svelte's
// anchors in a new one (an empty `<svelte:element>`'s) go, anything else is a
// mistake. Parts dropped while the content was elsewhere are destroyed.
export const drawContent =
  (content: Content) => (element: Element, context: DrawContext, fresh: boolean) => {
    if (fresh) {
      for (const child of [...element.childNodes]) {
        if (child instanceof Comment || (child instanceof Text && !child.length)) child.remove();
        else
          throw new Error(
            `A ${context.words.name} content element is drawn empty: the content goes in it (use ${context.words.content} on an empty element)`
          );
      }
    }
    content.list = drawList(content.views ?? [], content.list, context);
    const { parts } = content.list;
    if (fresh) {
      const kept = new Set(parts);
      for (const part of content.placed) if (!kept.has(part)) destroyPart(part);
    }
    placeParts(element, parts, fresh ? [] : content.placed);
    content.placed = parts;
  };

type State = {
  elt: DecoElt;
  node: Node;
  nodeProps: { node: Node; getPos: () => number };
  content: Content;
  slot: Slot;
  getPos: () => number;
  handle: { atom: boolean };
};

const states = new WeakMap<Part, State>();

const propsOf = ({ elt, nodeProps, slot }: State) => ({
  ...attrsToRecord(shapeAttributes(elt)),
  nodeProps,
  contentDOMRef: slot.attach,
});

export const ShapeView = (
  before: Part | undefined,
  key: string,
  { elt, node, views, selected, rooted }: ShapeDraw,
  context: DrawContext
): RootPart => {
  const component = shapeComponent(elt);
  const state = before && states.get(before);
  if (before?.kind == "root" && before.view == "shape" && state && before.component == component) {
    const changed = !state.elt.eq(elt) || state.node != node;
    if (state.node != node) state.nodeProps = { node, getPos: state.getPos };
    state.elt = elt;
    state.node = node;
    state.handle.atom = !elt.hasContent;
    if (changed) before.update(propsOf(state));
    if (state.content.views != views) {
      state.content.views = views;
      state.slot.draw();
    }
    before.set(selected, elt.tagName);
    return before;
  }
  const { handle, ref, contentDOMRef } = createShapeHandle();
  handle.atom = !elt.hasContent;
  const handlers = createDecorationHandlers(nodePos(handle, context.words.name));
  const content: Content = { views, list: null, placed: [] };
  const slot = createSlot(context, drawContent(content), contentDOMRef);
  const fresh: State = {
    elt,
    node,
    nodeProps: { node, getPos: handlers.getPos },
    content,
    slot,
    getPos: handlers.getPos,
    handle,
  };
  const part = mountDecoration(
    {
      key,
      view: "shape",
      what: "shape",
      component,
      props: propsOf(fresh),
      handlers,
      selected,
      tagName: elt.tagName,
      rooted: (dom) => {
        ref(dom);
        decorationRoot(handlers)(dom);
        if (slot.element() && !slot.attached()) slot.fallback(dom);
        rooted?.(dom);
      },
      destroy: () => {
        slot.destroy();
        content.placed.forEach(destroyPart);
      },
    },
    context
  );
  states.set(part, fresh);
  // Without `contentDOMRef`, the root holds the content.
  if (elt.hasContent) context.settle.push(() => slot.fallback(part.dom));
  return part;
};
