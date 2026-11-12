// Adapted from react-wordgard's ReactMarkView (by way of vue-wordgard's VueMarkView) for Svelte: a
// Svelte mark's component, mounted, its content in the element it attaches `contentDOMRef` to, or
// its root.
import type { Mark } from "wordgard/doc";

import {
  type ChildView,
  type DecoElt,
  attrsToRecord,
  createDecorationHandlers,
  createShapeHandle,
  decorationRoot,
  shapeAttributes,
} from "@stesura/wordgard-view";
import { markComponent } from "../../decorations/SvelteMarkType.js";
import { type Slot, createSlot } from "../../helpers/slot.js";
import { type DrawContext, type Part, type RootPart, destroyPart } from "../ChildNodeViews.js";
import { mountDecoration } from "../DecorationView.js";
import { type Content, drawContent } from "../ShapeView.js";

type State = {
  elt: DecoElt;
  mark: Mark;
  markProps: { mark: Mark; getPos: () => number };
  content: Content;
  slot: Slot;
  getPos: () => number;
};

const states = new WeakMap<Part, State>();

const propsOf = ({ elt, markProps, slot }: State) => ({
  ...attrsToRecord(shapeAttributes(elt)),
  markProps,
  contentDOMRef: slot.attach,
});

export const SvelteMarkView = (
  before: Part | undefined,
  key: string,
  elt: DecoElt,
  mark: Mark,
  views: readonly ChildView[],
  context: DrawContext
): RootPart => {
  const component = markComponent(elt);
  const state = before && states.get(before);
  if (before?.kind == "root" && before.view == "mark" && state && before.component == component) {
    if (!state.elt.eq(elt) || !state.mark.eq(mark)) {
      if (!state.mark.eq(mark)) state.markProps = { mark, getPos: state.getPos };
      state.elt = elt;
      state.mark = mark;
      before.update(propsOf(state));
    }
    if (state.content.views != views) {
      state.content.views = views;
      state.slot.draw();
    }
    before.set(false, elt.tagName);
    return before;
  }
  const { handle, ref, contentDOMRef } = createShapeHandle();
  const handlers = createDecorationHandlers(() => {
    const tile = handle.root?.isConnected ? handle.root.wgTile : undefined;
    if (!tile) throw new Error(`This ${context.words.name} mark isn't drawn`);
    return tile.posBefore;
  });
  const content: Content = { views, list: null, placed: [] };
  const slot = createSlot(context, drawContent(content), contentDOMRef);
  const fresh: State = {
    elt,
    mark,
    markProps: { mark, getPos: handlers.getPos },
    content,
    slot,
    getPos: handlers.getPos,
  };
  const part = mountDecoration(
    {
      key,
      view: "mark",
      what: "mark",
      component,
      props: propsOf(fresh),
      handlers,
      // A mark is no node: never selected.
      selected: false,
      tagName: elt.tagName,
      rooted: (dom) => {
        ref(dom);
        decorationRoot(handlers)(dom);
        if (slot.element() && !slot.attached()) slot.fallback(dom);
      },
      destroy: () => {
        slot.destroy();
        content.placed.forEach(destroyPart);
      },
    },
    context
  );
  states.set(part, fresh);
  context.settle.push(() => slot.fallback(part.dom));
  return part;
};
