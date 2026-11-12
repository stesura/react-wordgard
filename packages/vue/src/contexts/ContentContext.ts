// Not in react-wordgard, where a decoration's component gets what it holds as `children`. A Vue
// slot would leave anchors (empty text nodes) beside the content, so a decoration provides it and
// the component draws it with NodeContent (a shape's or mark's content) or WrappedNode (what a
// wrapper or node wrapper wraps). Each is a shallowRef the decoration sets as it renders, read by
// those components, which commit inside the flush (sync.ts).
import type { InjectionKey, ShallowRef, VNode } from "vue";

import type { ChildView } from "@stesura/wordgard-view";
import type { DOMRef } from "../helpers/refs.js";

export type ContentContextValue = {
  // The views laid out for the content, null for an atom.
  readonly views: ShallowRef<readonly ChildView[] | null>;
  // Given the content element.
  readonly ref: DOMRef;
};

// Null below what has no content of its own (a widget, a wrapper), so a
// NodeContent there doesn't draw the content of a shape around it.
export const ContentKey: InjectionKey<ContentContextValue | null> = Symbol("content");

export type WrappedContextValue = {
  // Draws what's wrapped.
  readonly draw: ShallowRef<() => VNode>;
};

export const WrappedKey: InjectionKey<WrappedContextValue | null> = Symbol("wrapped");
