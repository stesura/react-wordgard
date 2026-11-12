// Not in react-wordgard, where a decoration's component puts `children` where it wants them. A
// Svelte component marks an element with an attachment it's given (`contentDOMRef`,
// `wrappedDOMRef`), and we draw into it. The attachment runs in the component's own context: what
// we draw there (Svelte decorations in a shape's content) gets the component's contexts, as React's
// children get their parent's.
import { getAllContexts } from "svelte";
import type { Attachment } from "svelte/attachments";

import type { DrawContext } from "../components/ChildNodeViews.js";

export type Slot = {
  // For the component's props.
  readonly attach: Attachment<Element>;
  // The element it's drawn in, null before the component attached one.
  readonly element: () => Element | null;
  // Whether the component attached an element.
  readonly attached: () => boolean;
  // Draws again now, if attached.
  readonly draw: () => void;
  // Takes `element` if the component attached none (a content element is
  // the root by default), and the root Svelte replaces it with after. What's
  // drawn there then gets the decoration's contexts, not the component's: no
  // attachment runs in it.
  readonly fallback: (element: Element) => void;
  readonly destroy: () => void;
};

// `render` draws into the element, given the drawing context of what's in it;
// `fresh` when the element is new to it. `changed` hears the element change.
export const createSlot = (
  context: DrawContext,
  render: (element: Element, context: DrawContext, fresh: boolean) => void,
  changed: (element: Element | null) => void
): Slot => {
  let element: Element | null = null;
  let inner = context;
  let attached = false;
  let destroyed = false;
  const take = (dom: Element, contexts: Map<unknown, unknown> | null) => {
    const fresh = dom != element;
    element = dom;
    if (contexts) inner = { ...context, contexts };
    changed(dom);
    render(dom, inner, fresh);
  };
  const attach: Attachment<Element> = (dom) => {
    if (destroyed) return;
    attached = true;
    let contexts: Map<unknown, unknown> | null = null;
    try {
      contexts = new Map(getAllContexts());
    } catch {
      // Outside a component's context: the decoration's own.
    }
    take(dom, contexts);
    return () => {
      if (element != dom) return;
      element = null;
      changed(null);
    };
  };
  return {
    attach,
    element: () => element,
    attached: () => attached,
    draw: () => {
      if (element) render(element, inner, false);
    },
    fallback: (dom) => {
      if (!attached && !destroyed && dom != element) take(dom, null);
    },
    destroy: () => {
      destroyed = true;
    },
  };
};
