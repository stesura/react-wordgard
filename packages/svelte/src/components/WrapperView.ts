// Adapted from react-wordgard's WrapperView (by way of vue-wordgard's) for Svelte: a Svelte
// wrapper's component, mounted. What it wraps is drawn as the first child of the element it
// attaches `wrappedDOMRef` to.
import type { Node } from "wordgard/doc";

import {
  type DecoElt,
  attrsToRecord,
  createDecorationHandlers,
  createWrapperHandle,
  decorationRoot,
  nodePos,
  shapeAttributes,
} from "@stesura/wordgard-view";
import { wrapperComponent } from "../decorations/SvelteWrapperType.js";
import { type Slot, createSlot } from "../helpers/slot.js";
import {
  type DrawContext,
  type Part,
  type RootPart,
  destroyPart,
  placeParts,
  placedFirst,
} from "./ChildNodeViews.js";
import { mountDecoration } from "./DecorationView.js";

// Draws what's wrapped, its root given to `rooted`.
export type Wrapped = (
  before: Part | undefined,
  rooted: (root: Element) => void,
  context: DrawContext
) => Part;

export type WrapperDraw = {
  readonly elt: DecoElt;
  readonly node: Node;
  readonly wrapped: Wrapped;
  readonly selected: boolean;
  readonly rooted?: (root: Element) => void;
};

type State = {
  elt: DecoElt;
  node: Node;
  nodeProps: { node: Node; getPos: () => number };
  wrapped: Wrapped;
  part: Part | null;
  slot: Slot;
  getPos: () => number;
};

const states = new WeakMap<Part, State>();

const propsOf = ({ elt, nodeProps, slot }: State) => ({
  ...attrsToRecord(shapeAttributes(elt)),
  nodeProps,
  wrappedDOMRef: slot.attach,
});

export const WrapperView = (
  before: Part | undefined,
  key: string,
  { elt, node, wrapped, selected, rooted }: WrapperDraw,
  context: DrawContext
): RootPart => {
  const component = wrapperComponent(elt);
  const state = before && states.get(before);
  if (
    before?.kind == "root" &&
    before.view == "wrapper" &&
    state &&
    before.component == component
  ) {
    const changed = !state.elt.eq(elt) || state.node != node;
    if (state.node != node) state.nodeProps = { node, getPos: state.getPos };
    state.elt = elt;
    state.node = node;
    state.wrapped = wrapped;
    if (changed) before.update(propsOf(state));
    state.slot.draw();
    before.set(selected, elt.tagName);
    return before;
  }
  const { handle, ref, wrappedRef } = createWrapperHandle();
  const handlers = createDecorationHandlers(nodePos(handle, context.words.name));
  const render = (element: Element, inner: DrawContext) => {
    const last = fresh.part;
    const next = fresh.wrapped(last ?? undefined, wrappedRef, inner);
    placedFirst.add(element);
    placeParts(element, [next], last ? [last] : []);
    // First in its element, before the component's own children.
    if (next.dom && element.firstChild != next.dom)
      element.insertBefore(next.dom, element.firstChild);
    fresh.part = next;
    if (next.dom instanceof Element) wrappedRef(next.dom);
  };
  const slot = createSlot(context, render, (element) => {
    if (!element) wrappedRef(null);
  });
  const fresh: State = {
    elt,
    node,
    nodeProps: { node, getPos: handlers.getPos },
    wrapped,
    part: null,
    slot,
    getPos: handlers.getPos,
  };
  const part = mountDecoration(
    {
      key,
      view: "wrapper",
      what: "wrapper",
      component,
      props: propsOf(fresh),
      handlers,
      selected,
      tagName: elt.tagName,
      rooted: (dom) => {
        ref(dom);
        decorationRoot(handlers)(dom);
        rooted?.(dom);
      },
      destroy: () => {
        slot.destroy();
        if (fresh.part) destroyPart(fresh.part);
      },
    },
    context
  );
  states.set(part, fresh);
  return part;
};
